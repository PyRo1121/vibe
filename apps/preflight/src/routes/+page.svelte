<script lang="ts">
	import { browser } from '$app/environment';
	import {
		buildShareText,
		clearCheckoutQuery,
		saveBaselineChecks,
		STORAGE,
		toCheckSnapshots
	} from '$lib/client/preflight-session';
	import { trackFunnel } from '$lib/client/track';
	import AiCopyReviewPanel from '$lib/components/AiCopyReviewPanel.svelte';
	import Checklist from '$lib/components/Checklist.svelte';
	import DeepDivesSection from '$lib/components/DeepDivesSection.svelte';
	import LaunchBriefPanel from '$lib/components/LaunchBriefPanel.svelte';
	import MasterPromptPanel from '$lib/components/MasterPromptPanel.svelte';
	import PagesScannedStrip from '$lib/components/PagesScannedStrip.svelte';
	import PostUnlockGuide from '$lib/components/PostUnlockGuide.svelte';
	import ReportSummary from '$lib/components/ReportSummary.svelte';
	import RepoSummaryPanel from '$lib/components/RepoSummaryPanel.svelte';
	import ScanIncompleteBanner from '$lib/components/ScanIncompleteBanner.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import UnlockComparePanel from '$lib/components/UnlockComparePanel.svelte';
	import UnlockPanel from '$lib/components/UnlockPanel.svelte';
	import UnlockStickyBar from '$lib/components/UnlockStickyBar.svelte';
	import VerdictBanner from '$lib/components/VerdictBanner.svelte';
	import { ALPHA_DISCLAIMER, ALPHA_FREE_UNLOCK, ALPHA_PRICE_PREVIEW } from '$lib/product/alpha';
	import type { DeploylintPlanId } from '$lib/product/plans';
	import type { ScanReport } from '$lib/scan/types';
	import { buildDeploylintJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let url = $state('');
	let loading = $state(false);
	let checkoutLoading = $state(false);
	let billingPortalLoading = $state(false);
	let error = $state<string | null>(null);
	let checkoutMessage = $state<string | null>(null);
	let report = $state<ScanReport | null>(null);
	let unlockSessionId = $state<string | null>(null);
	let copiedId = $state<string | null>(null);
	let shareCopied = $state(false);
	let scanController: AbortController | null = null;
	let copyTimeouts: ReturnType<typeof setTimeout>[] = [];

	let sessionHydrated = false;

	const PROGRESS_STEPS = [
		'Fetching homepage…',
		'Crawling privacy, terms & pricing pages…',
		'Checking links, robots.txt & sitemap…',
		'Verifying social preview image…',
		'Scanning JS bundles for secrets & licenses…',
		'Probing 404 handling & DNS records…',
		'Scoring 90+ launch signals…'
	];
	let progressIdx = $state(0);

	$effect(() => {
		if (!loading) return;
		progressIdx = 0;
		const timer = setInterval(() => {
			progressIdx = Math.min(progressIdx + 1, PROGRESS_STEPS.length - 1);
		}, 1100);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (!browser || sessionHydrated) return;
		sessionHydrated = true;

		const storedSession = sessionStorage.getItem(STORAGE.unlockSession);
		const storedUrl = sessionStorage.getItem(STORAGE.scanUrl);
		if (storedSession) unlockSessionId = storedSession;
		if (storedUrl && !url) url = storedUrl;

		if (data.checkout === 'cancel') {
			checkoutMessage = 'Checkout canceled — your scan results are still free.';
			clearCheckoutQuery();
			return;
		}

		if (data.checkout === 'success' && data.sessionId) {
			unlockSessionId = data.sessionId;
			sessionStorage.setItem(STORAGE.unlockSession, data.sessionId);
			if (storedUrl) url = storedUrl;
			checkoutMessage = 'Payment received — loading your fix prompts…';
			clearCheckoutQuery();
			if (url.trim()) void runScan(false);
		}

		if (data.billing === 'return') {
			checkoutMessage = 'Billing settings updated.';
			clearCheckoutQuery();
		}
	});

	$effect(() => {
		return () => {
			scanController?.abort();
			for (const timer of copyTimeouts) clearTimeout(timer);
		};
	});

	async function runScan(rescan = false) {
		scanController?.abort();
		scanController = new AbortController();
		const { signal } = scanController;

		error = null;
		if (!rescan) report = null;
		loading = true;
		try {
			const payload: {
				url: string;
				unlockSessionId?: string;
				previousScore?: number;
			} = { url: url.trim() };
			if (unlockSessionId && !ALPHA_FREE_UNLOCK) payload.unlockSessionId = unlockSessionId;
			if (rescan && (unlockSessionId || ALPHA_FREE_UNLOCK)) {
				const baseline = sessionStorage.getItem(STORAGE.baselineScore);
				if (baseline) payload.previousScore = Number(baseline);
			}

			const res = await fetch('/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message ?? `Scan failed (${res.status})`);
			}
			report = (await res.json()) as ScanReport;
			sessionStorage.setItem(STORAGE.scanUrl, url.trim());

			if (!rescan) {
				sessionStorage.setItem(STORAGE.baselineScore, String(report.score));
				saveBaselineChecks(toCheckSnapshots(report.checks));
			}
			if (report.unlocked && unlockSessionId) {
				sessionStorage.setItem(STORAGE.unlockSession, unlockSessionId);
			}

			if (report.unlocked) {
				if (report.scoreDelta != null && report.previousScore != null) {
					const sign = report.scoreDelta >= 0 ? '+' : '';
					checkoutMessage = `Verified: ${report.previousScore} → ${report.score} (${sign}${report.scoreDelta})`;
				} else {
					checkoutMessage = ALPHA_FREE_UNLOCK
						? 'Subscription access active - all fix prompts are available.'
						: 'Fix prompts unlocked — copy prompts below, then re-scan after fixing.';
				}
			}

			const issueCount = report.checks.filter((c) => c.status !== 'pass').length;
			trackFunnel(rescan && report.scoreDelta != null ? 'rescan_completed' : 'scan_completed', {
				verdict: report.verdict,
				score: report.score,
				unlocked: report.unlocked,
				issueCount,
				...(report.scoreDelta == null ? {} : { scoreDelta: report.scoreDelta })
			});
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			error = err instanceof Error ? err.message : 'Scan failed';
		} finally {
			loading = false;
		}
	}

	async function startCheckout(plan: DeploylintPlanId = 'solo') {
		if (!url.trim() || !report) return;
		if (ALPHA_FREE_UNLOCK) {
			checkoutMessage = 'Checkout is disabled while paid features are included free.';
			return;
		}
		trackFunnel('unlock_click', { verdict: report.verdict, score: report.score, plan });
		checkoutLoading = true;
		checkoutMessage = null;
		error = null;
		try {
			const res = await fetch('/api/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: url.trim(), plan })
			});
			const body = (await res.json().catch(() => null)) as {
				message?: string;
				url?: string;
			} | null;
			if (!res.ok) {
				throw new Error(body?.message ?? `Checkout failed (${res.status})`);
			}
			if (!body?.url) throw new Error('Checkout URL missing');
			sessionStorage.setItem(STORAGE.scanUrl, url.trim());
			window.location.href = body.url;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Checkout failed';
		} finally {
			checkoutLoading = false;
		}
	}

	async function openBillingPortal() {
		if (!url.trim() || !unlockSessionId) return;
		billingPortalLoading = true;
		checkoutMessage = null;
		error = null;
		try {
			const res = await fetch('/api/billing/portal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: url.trim(), unlockSessionId })
			});
			const body = (await res.json().catch(() => null)) as {
				message?: string;
				url?: string;
			} | null;
			if (!res.ok) {
				throw new Error(body?.message ?? `Billing portal failed (${res.status})`);
			}
			if (!body?.url) throw new Error('Billing portal URL missing');
			window.location.href = body.url;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Billing portal failed';
		} finally {
			billingPortalLoading = false;
		}
	}

	async function copyPrompt(id: string, text: string) {
		await navigator.clipboard.writeText(text);
		copiedId = id;
		copyTimeouts.push(
			setTimeout(() => {
				if (copiedId === id) copiedId = null;
			}, 2000)
		);
	}

	async function copyShareText() {
		if (!report) return;
		await navigator.clipboard.writeText(buildShareText(report, data.appUrl));
		shareCopied = true;
		copyTimeouts.push(setTimeout(() => (shareCopied = false), 2000));
	}

	const appOrigin = $derived(data.appUrl.replace(/\/$/, ''));
	const title = buildSeoTitle('Payment readiness checker for AI-built SaaS');
	const description =
		'Scan an AI-built SaaS before charging users. Deploylint checks checkout, signed webhooks, entitlements, billing self-service, exposed secrets, SEO blockers, and launch polish.';
	const jsonLd = $derived(buildDeploylintJsonLd({ base: appOrigin, description, price: '0.00' }));
</script>

<SeoHead
	{title}
	{description}
	canonical={`${appOrigin}/`}
	image={defaultSeoImage(appOrigin)}
	{jsonLd}
/>

<div class="mx-auto max-w-5xl px-4 py-12">
	<section class="mb-12 text-center print:hidden">
		<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
			Before your AI-built SaaS charges users
		</p>
		<h1 class="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
			Can this AI-built SaaS safely take money?
		</h1>
		<p class="mx-auto max-w-2xl text-lg text-zinc-400">
			<strong class="font-medium text-zinc-300">90+ checks in seconds</strong> — {'checkout, signed webhooks, entitlements, billing self-service'},
			exposed secrets, broken share images, robots blocking Google, and more. Paste a live URL or a
			public
			<strong class="font-medium text-zinc-300">GitHub repo</strong> (committed .env files,
			dependency licenses, sell rights). Built for apps you ship — bot-protected enterprise sites
			may scan incomplete. Free scans show the verdict and one sample prompt. Subscription unlock
			starts from
			<span class="font-medium text-zinc-300">{ALPHA_PRICE_PREVIEW.later}</span>
			for every fix prompt, master repair paste, MCP access, and recurring monitoring.
			<a
				href="/compare"
				class="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
			>
				See how we compare →
			</a>
		</p>
	</section>

	<section
		class="mx-auto mb-10 max-w-2xl rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 print:hidden"
		aria-label="Pricing notice"
	>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
					{ALPHA_PRICE_PREVIEW.current}
				</p>
				<p class="mt-2 text-sm text-zinc-300">{ALPHA_DISCLAIMER}</p>
			</div>
			<div class="shrink-0 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
				<p class="text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">
					Full release price
				</p>
				<p class="mt-1 text-lg font-bold text-white">{ALPHA_PRICE_PREVIEW.later}</p>
			</div>
		</div>
		<ul class="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
			{#each ALPHA_PRICE_PREVIEW.hiddenLater as item (item)}
				<li class="flex gap-2">
					<span class="text-sky-400">+</span>
					<span>{item}</span>
				</li>
			{/each}
		</ul>
	</section>

	<form
		class="mx-auto mb-10 max-w-2xl print:hidden"
		onsubmit={(e) => {
			e.preventDefault();
			const trimmed = url.trim();
			const prevUrl = sessionStorage.getItem(STORAGE.scanUrl);
			if (prevUrl && prevUrl !== trimmed) {
				unlockSessionId = null;
				sessionStorage.removeItem(STORAGE.unlockSession);
				sessionStorage.removeItem(STORAGE.baselineScore);
				sessionStorage.removeItem(STORAGE.baselineChecks);
			}
			runScan(false);
		}}
	>
		<div class="flex flex-col gap-3 sm:flex-row">
			<label for="scan-url" class="sr-only">URL to scan</label>
			<input
				id="scan-url"
				type="text"
				inputmode="url"
				autocomplete="url"
				bind:value={url}
				required
				placeholder="your-app.com or github.com/you/repo"
				class="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
			/>
			<button
				type="submit"
				disabled={loading || !url.trim()}
				class="rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-500 disabled:bg-sky-900 disabled:text-sky-100"
			>
				{loading ? 'Scanning…' : 'Scan free'}
			</button>
		</div>
		{#if loading}
			<p class="mt-3 flex items-center gap-2 text-sm text-zinc-400" role="status">
				<span
					class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-sky-400"
				></span>
				{PROGRESS_STEPS[progressIdx]}
			</p>
		{/if}
		{#if error}
			<p class="mt-3 text-sm text-red-400" role="alert">{error}</p>
		{/if}
		{#if checkoutMessage}
			<p class="mt-3 text-sm text-sky-300" role="status">{checkoutMessage}</p>
		{/if}
	</form>

	{#if report}
		{#if ALPHA_FREE_UNLOCK}
			<section
				class="mb-6 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 print:hidden"
				aria-label="Unlocked report notice"
			>
				<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
					Subscription access unlocked
				</p>
				<p class="mt-2 text-sm text-zinc-300">
					Your plan unlocks the prompts, master paste, AI copy review, and re-scan proof shown
					below.
				</p>
			</section>
		{/if}
		{#if report.unlocked && unlockSessionId && !ALPHA_FREE_UNLOCK}
			<section
				class="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:flex-row sm:items-center sm:justify-between print:hidden"
				aria-label="Billing self-service"
			>
				<div>
					<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
						Subscription active
					</p>
					<p class="mt-1 text-sm text-zinc-400">
						Manage invoices, payment methods, cancellation, and plan changes in Stripe.
					</p>
				</div>
				<button
					type="button"
					disabled={billingPortalLoading}
					class="shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:border-sky-500 hover:text-sky-200 disabled:opacity-50"
					onclick={openBillingPortal}
				>
					{billingPortalLoading ? 'Opening...' : 'Manage billing'}
				</button>
			</section>
		{/if}
		<VerdictBanner {report} />
		<RepoSummaryPanel {report} />
		<ScanIncompleteBanner {report} />
		<PagesScannedStrip {report} />
		{#if report.scanCoverage !== 'blocked'}
			<ReportSummary
				{report}
				{loading}
				{shareCopied}
				onShare={copyShareText}
				onRescan={() => runScan(true)}
				permalink={report.reportId
					? `${data.appUrl.replace(/\/$/, '')}/r/${report.reportId}`
					: null}
			/>
		{/if}
		<LaunchBriefPanel {report} />
		<PostUnlockGuide {report} />
		{#if report.unlocked && report.masterPrompt}
			<MasterPromptPanel
				masterPrompt={report.masterPrompt}
				copied={copiedId === 'master'}
				onCopy={() => copyPrompt('master', report?.masterPrompt ?? '')}
			/>
		{/if}
		<AiCopyReviewPanel
			{report}
			copied={copiedId === 'ai-copy'}
			onCopy={(text) => copyPrompt('ai-copy', text)}
		/>
		<Checklist {report} {copiedId} onCopyPrompt={copyPrompt} />
		<DeepDivesSection {report} />
		{#if !report.unlocked}
			<div class="pb-20 md:pb-0 print:hidden">
				<UnlockComparePanel {report} {checkoutLoading} onCheckout={startCheckout} />
				<UnlockPanel {report} {checkoutLoading} onCheckout={startCheckout} />
			</div>
			<UnlockStickyBar {report} {checkoutLoading} onCheckout={startCheckout} />
		{/if}
	{:else if !loading}
		<section class="mb-8 text-center">
			<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
				What Lighthouse and OG checkers miss
			</p>
		</section>
		<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Launch judgment</p>
				<p class="mt-1 text-sm text-zinc-400">
					GO / CONDITIONAL / NO-GO — ship/no-ship, not a perf score
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Embarrassment radar</p>
				<p class="mt-1 text-sm text-zinc-400">
					Privacy gaps, placeholder copy, dead links critics click first
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Fix & prove loop</p>
				<p class="mt-1 text-sm text-zinc-400">
					Free scan, then Solo from $9/mo for Cursor prompts and before/after re-scan proof
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">og:image content-type</p>
				<p class="mt-1 text-sm text-zinc-400">
					Catches SPA routes returning HTML instead of a real image
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">GitHub repo scan</p>
				<p class="mt-1 text-sm text-zinc-400">
					Committed .env files, sell-rights licenses, OSV vulnerabilities
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">CI deploy gate</p>
				<p class="mt-1 text-sm text-zinc-400">
					Block bad deploys in CI — same GO/NO-GO in GitHub Actions before users see them
				</p>
			</div>
		</section>
		<section
			class="mt-6 rounded-2xl border border-sky-900/50 bg-sky-950/20 p-6 text-left sm:flex sm:items-center sm:justify-between sm:gap-6"
		>
			<div>
				<p class="font-medium text-white">Not Lighthouse. Not an OG debugger.</p>
				<p class="mt-1 text-sm text-zinc-400">
					Honest side-by-side — where Deploylint wins and where it does not.
				</p>
			</div>
			<a
				href="/compare"
				class="mt-4 inline-block shrink-0 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 sm:mt-0"
			>
				Compare tools →
			</a>
		</section>
	{/if}
</div>
