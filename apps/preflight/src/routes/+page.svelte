<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
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
	import CiReportPreview from '$lib/components/CiReportPreview.svelte';
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
	let pricingTracked = false;
	let lockedPromptTrackedFor: string | null = null;

	const PROGRESS_STEPS = [
		'Fetching homepage…',
		'Crawling privacy, terms & pricing pages…',
		'Checking links, robots.txt & sitemap…',
		'Verifying social preview image…',
		'Scanning JS bundles for secrets & licenses…',
		'Probing 404 handling & DNS records…',
		'Scoring deploy-readiness evidence…'
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

	const alphaFreeUnlock = $derived(data.alphaFreeUnlock);

	$effect(() => {
		if (pricingTracked) return;
		pricingTracked = true;
		trackFunnel('pricing_viewed', { mode: alphaFreeUnlock ? 'alpha' : 'paid' });
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
			if (unlockSessionId && !alphaFreeUnlock) payload.unlockSessionId = unlockSessionId;
			if (rescan && (unlockSessionId || alphaFreeUnlock)) {
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
					checkoutMessage = alphaFreeUnlock
						? 'Alpha access active - repair plans and verification proof are available.'
						: 'Repair plan unlocked - follow the fixes below, then verify fixes.';
				}
			}

			const issueCount = report.checks.filter((c) => c.status !== 'pass').length;
			if (!report.unlocked && lockedPromptTrackedFor !== report.finalUrl) {
				lockedPromptTrackedFor = report.finalUrl;
				trackFunnel('locked_prompt_viewed', {
					verdict: report.verdict,
					score: report.score,
					issueCount,
					mode: alphaFreeUnlock ? 'alpha' : 'paid'
				});
			}
			trackFunnel(rescan && report.scoreDelta != null ? 'rescan_completed' : 'scan_completed', {
				verdict: report.verdict,
				score: report.score,
				unlocked: report.unlocked,
				issueCount,
				mode: alphaFreeUnlock ? 'alpha' : 'paid',
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
		if (alphaFreeUnlock) {
			checkoutMessage = 'Checkout is disabled while paid features are included free.';
			return;
		}
		trackFunnel('unlock_click', {
			verdict: report.verdict,
			score: report.score,
			plan,
			mode: 'paid'
		});
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
			trackFunnel('checkout_started', {
				verdict: report.verdict,
				score: report.score,
				plan,
				mode: 'paid'
			});
			window.location.href = body.url;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Checkout failed';
		} finally {
			checkoutLoading = false;
		}
	}

	async function openBillingPortal() {
		if (!url.trim() || !unlockSessionId) return;
		trackFunnel('billing_portal_opened', { mode: 'paid' });
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
	const title = buildSeoTitle('Project readiness before deploy');
	const description =
		'Review CI risk, repo hygiene, license and sell-rights evidence, payment readiness, and public deploy blockers before production.';
	const jsonLd = $derived(buildDeploylintJsonLd({ base: appOrigin, description, price: '0.00' }));
	const quickInstallYaml = $derived(`name: Deploylint advisory report

on:
  pull_request:

permissions: {}

jobs:
  deploylint:
    runs-on: ubuntu-latest
    steps:
      - name: Report deploy risk
        env:
          DEPLOYLINT_URL: \${{ secrets.DEPLOYLINT_URL }}
          DEPLOYLINT_API: ${appOrigin}
          DEPLOYLINT_MODE: advisory
        run: |
          if [ -z "$DEPLOYLINT_URL" ]; then
            echo "Skipping Deploylint advisory report because DEPLOYLINT_URL is unavailable (forked pull request secrets are not exposed)."
            exit 0
          fi
          curl -fsSL ${appOrigin}/gate-remote.mjs -o gate-remote.mjs
          node gate-remote.mjs "$DEPLOYLINT_URL"`);
</script>

<SeoHead
	{title}
	{description}
	canonical={`${appOrigin}/`}
	image={defaultSeoImage(appOrigin)}
	{jsonLd}
/>

<div class="mx-auto max-w-5xl px-4 py-12">
	<section class="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end print:hidden">
		<div>
			<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
				Project readiness + CI hardening
			</p>
			<h1 class="mb-4 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
				Prove the project is ready before deploy.
			</h1>
			<p class="max-w-3xl text-lg leading-8 text-zinc-400">
				Deploylint reviews the path from pull request to production: GitHub Actions permissions,
				pull_request_target hazards, floating actions, missing quality gates, repo hygiene, license
				and sell-rights evidence, payment readiness, public trust, and the last checks that should
				block a bad deploy. Start with the
				<a
					href={resolve('/tools/github-actions-security-checker')}
					class="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
				>
					GitHub Actions Security Checker
				</a>
				or add Deploylint to CI as an advisory report first.
				<a
					href={resolve('/compare')}
					class="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
				>
					See how we compare →
				</a>
			</p>
			<div class="mt-6 flex flex-col gap-3 sm:flex-row">
				<a
					href={resolve('/app')}
					class="rounded-xl bg-sky-500 px-5 py-3 text-center text-sm font-semibold text-zinc-950 hover:bg-sky-400"
				>
					Create project
				</a>
				<a
					href={resolve('/tools/github-actions-security-checker')}
					class="rounded-xl border border-zinc-700 px-5 py-3 text-center text-sm font-semibold text-white hover:border-sky-500 hover:text-sky-200"
				>
					Check workflow YAML
				</a>
			</div>
		</div>
		<CiReportPreview compact />
	</section>

	<section class="mb-8 grid gap-4 md:grid-cols-3 print:hidden">
		<a
			href={resolve('/tools/github-actions-security-checker')}
			class="rounded-xl border border-sky-500/40 bg-sky-500/5 p-5 text-left transition hover:border-sky-400"
		>
			<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">Workflow risk</p>
			<h2 class="mt-2 font-semibold text-white">Audit GitHub Actions before merge</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Paste workflow YAML and catch risky permissions, pull_request_target usage, floating refs,
				and missing quality gates.
			</p>
		</a>
		<a
			href={resolve('/developers')}
			class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left transition hover:border-sky-500/70"
		>
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Deploy gate</p>
			<h2 class="mt-2 font-semibold text-white">Block bad deploys in CI</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Add a zero-install GitHub Actions gate that fails risky production launches.
			</p>
		</a>
		<a
			href={resolve('/tools')}
			class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left transition hover:border-sky-500/70"
		>
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Repo hygiene</p>
			<h2 class="mt-2 font-semibold text-white">Find deploy-path drift</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Check scripts, lockfiles, runtime pins, dependency signals, and public blockers.
			</p>
		</a>
	</section>

	<section class="mb-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] print:hidden">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">Install path</p>
			<h2 class="mt-2 text-2xl font-semibold tracking-tight text-white">
				Start advisory. Turn on blocking after the signal is clean.
			</h2>
			<ol class="mt-5 grid gap-3 text-sm leading-6 text-zinc-300 sm:grid-cols-3 lg:grid-cols-1">
				<li class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
					<span class="font-semibold text-white">1. Check workflow YAML</span>
					<span class="mt-1 block text-zinc-400">Catch risky permissions and missing gates.</span>
				</li>
				<li class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
					<span class="font-semibold text-white">2. Add advisory PR report</span>
					<span class="mt-1 block text-zinc-400">Show deploy risk without failing builds.</span>
				</li>
				<li class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
					<span class="font-semibold text-white">3. Switch to deploy gate</span>
					<span class="mt-1 block text-zinc-400">Block P0 risk once the report is trusted.</span>
				</li>
			</ol>
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
			<div class="mb-3 flex items-center justify-between gap-3">
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Copy into CI</p>
				<a
					class="text-xs font-semibold text-sky-300 hover:text-sky-200"
					href={resolve('/developers')}
				>
					Full setup →
				</a>
			</div>
			<pre
				class="max-h-80 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs leading-5 whitespace-pre-wrap text-zinc-300"><code
					>{quickInstallYaml}</code
				></pre>
		</div>
	</section>

	<form
		class="mx-auto mb-10 max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 print:hidden"
		aria-label="Readiness evidence"
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
		<div class="mb-4">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
				Readiness evidence
			</p>
			<h2 class="mt-2 text-lg font-semibold text-white">Run a project readiness review</h2>
			<p class="mt-1 text-sm leading-6 text-zinc-400">
				Add a deploy URL or GitHub repo to collect public surface, trust, payment, license, preview,
				and repo hygiene evidence after the CI path is under control.
			</p>
		</div>
		<div class="flex flex-col gap-3 sm:flex-row">
			<label for="scan-url" class="sr-only">Project or deploy target</label>
			<input
				id="scan-url"
				type="text"
				inputmode="url"
				autocomplete="url"
				bind:value={url}
				required
				placeholder="deploy URL or github.com/you/repo"
				class="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
			/>
			<button
				type="submit"
				disabled={loading || !url.trim()}
				class="rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-500 disabled:bg-sky-900 disabled:text-sky-100"
			>
				{loading ? 'Building brief...' : 'Build readiness brief'}
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
		{#if alphaFreeUnlock}
			<section
				class="mb-6 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 print:hidden"
				aria-label="Unlocked report notice"
			>
				<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
					Alpha access unlocked
				</p>
				<p class="mt-2 text-sm text-zinc-300">
					Your plan unlocks the repair plan, workspace workflow, copy readiness review, and
					verify-fixes proof shown below.
				</p>
			</section>
		{/if}
		{#if report.unlocked && unlockSessionId && !alphaFreeUnlock}
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
			{alphaFreeUnlock}
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
				Readiness evidence lanes
			</p>
		</section>
		<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Workflow hardening</p>
				<p class="mt-1 text-sm text-zinc-400">
					Check GitHub Actions for risky permissions, pull_request_target, and floating refs
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Deploy gates</p>
				<p class="mt-1 text-sm text-zinc-400">
					Fail bad deploys before production with GitHub Actions and agent-ready fixes
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Repo hygiene</p>
				<p class="mt-1 text-sm text-zinc-400">
					Package scripts, lockfiles, Node pins, env hygiene, and dependency signals
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Project readiness audit</p>
				<p class="mt-1 text-sm text-zinc-400">
					Crawler, trust, payment, preview, and repo checks after workflow risk is under control
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Fix evidence</p>
				<p class="mt-1 text-sm text-zinc-400">
					Guided repair plans, then before/after proof when the deploy path is clean
				</p>
			</div>
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">Low-noise decisions</p>
				<p class="mt-1 text-sm text-zinc-400">
					Clear blockers, advisory findings, and follow-up work instead of another vague score
				</p>
			</div>
		</section>
		<section
			class="mt-6 rounded-2xl border border-sky-900/50 bg-sky-950/20 p-6 text-left sm:flex sm:items-center sm:justify-between sm:gap-6"
		>
			<div>
				<p class="font-medium text-white">Compare deploy-control tools.</p>
				<p class="mt-1 text-sm text-zinc-400">
					Where Deploylint fits next to manual checklists, GitHub security features, and audits.
				</p>
			</div>
			<a
				href={resolve('/compare')}
				class="mt-4 inline-block shrink-0 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600 sm:mt-0"
			>
				Compare tools →
			</a>
		</section>
	{/if}
</div>
