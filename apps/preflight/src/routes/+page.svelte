<script lang="ts">
	import { browser } from '$app/environment';
	import type { ScanReport } from '$lib/scan/types';
	import { buildShareText, clearCheckoutQuery, STORAGE } from '$lib/client/preflight-session';
	import { trackFunnel } from '$lib/client/track';
	import VerdictBanner from '$lib/components/VerdictBanner.svelte';
	import ScanIncompleteBanner from '$lib/components/ScanIncompleteBanner.svelte';
	import PagesScannedStrip from '$lib/components/PagesScannedStrip.svelte';
	import RepoSummaryPanel from '$lib/components/RepoSummaryPanel.svelte';
	import LaunchBriefPanel from '$lib/components/LaunchBriefPanel.svelte';
	import ReportSummary from '$lib/components/ReportSummary.svelte';
	import MasterPromptPanel from '$lib/components/MasterPromptPanel.svelte';
	import AiCopyReviewPanel from '$lib/components/AiCopyReviewPanel.svelte';
	import PostUnlockGuide from '$lib/components/PostUnlockGuide.svelte';
	import Checklist from '$lib/components/Checklist.svelte';
	import UnlockPanel from '$lib/components/UnlockPanel.svelte';
	import UnlockComparePanel from '$lib/components/UnlockComparePanel.svelte';
	import UnlockStickyBar from '$lib/components/UnlockStickyBar.svelte';
	import DeepDivesSection from '$lib/components/DeepDivesSection.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let url = $state('');
	let loading = $state(false);
	let checkoutLoading = $state(false);
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
		'Scoring 60+ launch signals…'
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
			if (unlockSessionId) payload.unlockSessionId = unlockSessionId;
			if (rescan && unlockSessionId) {
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
			}
			if (report.unlocked && unlockSessionId) {
				sessionStorage.setItem(STORAGE.unlockSession, unlockSessionId);
			}

			if (report.unlocked) {
				if (report.scoreDelta != null && report.previousScore != null) {
					const sign = report.scoreDelta >= 0 ? '+' : '';
					checkoutMessage = `Verified: ${report.previousScore} → ${report.score} (${sign}${report.scoreDelta})`;
				} else {
					checkoutMessage = 'Fix prompts unlocked — copy prompts below, then re-scan after fixing.';
				}
			}

			const issueCount = report.checks.filter((c) => c.status !== 'pass').length;
			trackFunnel(
				rescan && unlockSessionId && report.scoreDelta != null
					? 'rescan_completed'
					: 'scan_completed',
				{
					verdict: report.verdict,
					score: report.score,
					unlocked: report.unlocked,
					issueCount,
					...(report.scoreDelta != null ? { scoreDelta: report.scoreDelta } : {})
				}
			);
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return;
			error = err instanceof Error ? err.message : 'Scan failed';
		} finally {
			loading = false;
		}
	}

	async function startCheckout() {
		if (!url.trim() || !report) return;
		trackFunnel('unlock_click', { verdict: report.verdict, score: report.score });
		checkoutLoading = true;
		checkoutMessage = null;
		error = null;
		try {
			const res = await fetch('/api/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: url.trim() })
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
	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: 'Preflight',
			url: appOrigin,
			description:
				'Launch-readiness audit for vibe-coded apps. GO/NO-GO verdict, embarrassment radar, social preview checks, and Cursor fix prompts.',
			applicationCategory: 'DeveloperApplication',
			offers: {
				'@type': 'Offer',
				price: '9.00',
				priceCurrency: 'USD',
				description: 'Unlock all fix prompts and re-scan proof for one URL'
			}
		})
	);
</script>

<svelte:head>
	<title>Preflight — Should you post this URL today?</title>
	<meta
		name="description"
		content="60+ launch checks: GO/NO-GO verdict, placeholder copy, broken og:image content-type, secrets in JS, llms.txt, and Cursor fix prompts with re-scan proof."
	/>
	<meta property="og:title" content="Preflight — Should you post this URL today?" />
	<meta
		property="og:description"
		content="Not Lighthouse. Launch judgment — embarrassment radar, social preview validation, and copy-paste Cursor fixes."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{appOrigin}/" />
	<meta property="og:image" content="{appOrigin}/og.svg" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Preflight — Should you post this URL today?" />
	<meta name="twitter:description" content="60+ launch checks before Product Hunt, Reddit, or X." />
	<meta name="twitter:image" content="{appOrigin}/og.svg" />
	<link rel="canonical" href="{appOrigin}/" />
	<link rel="icon" href="/og.svg" type="image/svg+xml" />
	<svelte:element this={"script"} type="application/ld+json">{jsonLd}</svelte:element>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-12">
	<section class="mb-12 text-center print:hidden">
		<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
			Before you post your URL anywhere public
		</p>
		<h1 class="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
			Should you post this URL today?
		</h1>
		<p class="mx-auto max-w-2xl text-lg text-zinc-400">
			<strong class="font-medium text-zinc-300">60+ checks in seconds</strong> — placeholders,
			broken share images, exposed secrets, robots blocking Google, and more. Paste a live URL or a
			public
			<strong class="font-medium text-zinc-300">GitHub repo</strong> (committed .env files,
			dependency licenses, sell rights). Built for apps you ship — bot-protected enterprise sites
			may scan incomplete. Free: verdict + embarrassment brief. Paid ($9): every Cursor fix prompt,
			master repair paste, and re-scans to prove you fixed it.
			<a href="/compare" class="text-sky-400 hover:underline">See how we compare →</a>
		</p>
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
				class="rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
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
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
				What Lighthouse and OG checkers miss
			</p>
		</section>
		<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Launch judgment</p>
				<p class="mt-1 text-sm text-zinc-500">
					GO / CONDITIONAL / NO-GO — ship/no-ship, not a perf score
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Embarrassment radar</p>
				<p class="mt-1 text-sm text-zinc-500">
					Privacy gaps, placeholder copy, dead links critics click first
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Fix & prove loop</p>
				<p class="mt-1 text-sm text-zinc-500">
					$9 unlock · Cursor prompts + before/after re-scan delta
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">og:image content-type</p>
				<p class="mt-1 text-sm text-zinc-500">
					Catches SPA routes returning HTML instead of a real image
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">GitHub repo scan</p>
				<p class="mt-1 text-sm text-zinc-500">
					Committed .env files, sell-rights licenses, OSV vulnerabilities
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">CI deploy gate</p>
				<p class="mt-1 text-sm text-zinc-500">
					Same GO/NO-GO in GitHub Actions — block bad deploys before users see them
				</p>
			</div>
		</section>
		<section
			class="mt-6 rounded-2xl border border-sky-900/50 bg-sky-950/20 p-6 text-left sm:flex sm:items-center sm:justify-between sm:gap-6"
		>
			<div>
				<p class="font-medium text-white">Not Lighthouse. Not an OG debugger.</p>
				<p class="mt-1 text-sm text-zinc-500">
					Honest side-by-side — where Preflight wins and where it does not.
				</p>
			</div>
			<a
				href="/compare"
				class="mt-4 inline-block shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 sm:mt-0"
			>
				Compare tools →
			</a>
		</section>
	{/if}
</div>
