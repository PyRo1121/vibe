<script lang="ts">
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		buildShareText,
		saveBaselineChecks,
		STORAGE,
		toCheckSnapshots
	} from '$lib/client/preflight-session';
	import { trackFunnel } from '$lib/client/track';
	import CiReportPreview from '$lib/components/CiReportPreview.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import type { DeploylintPlanId } from '$lib/product/plans';
	import type { ScanReport } from '$lib/scan/types';
	import { buildDeploylintJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	type ScanApiErrorBody = {
		code?: string;
		message?: string;
		retryAt?: string;
		status?: number;
	};

	type ScanApiError = {
		code: string | null;
		message: string;
		retryAt: string | null;
	};

	let { data }: { data: PageData } = $props();

	let url = $state('');
	let projectName = $state('');
	let repositoryUrl = $state('');
	let deployTarget = $state('');
	let loading = $state(false);
	let checkoutLoading = $state(false);
	let billingPortalLoading = $state(false);
	let error = $state<string | null>(null);
	let errorCode = $state<string | null>(null);
	let errorRetryAt = $state<string | null>(null);
	let checkoutMessage = $state<string | null>(null);
	let report = $state<ScanReport | null>(null);
	let unlockSessionId = $state<string | null>(null);
	let copiedId = $state<string | null>(null);
	let shareCopied = $state(false);
	let scanController: AbortController | null = null;
	let copyTimeouts: ReturnType<typeof setTimeout>[] = [];
	let queryClearTimeout: ReturnType<typeof setTimeout> | null = null;

	let sessionHydrated = false;
	let pricingTracked = false;
	let lockedPromptTrackedFor: string | null = null;

	const PROGRESS_STEPS = [
		'Preparing release-readiness evidence...',
		'Checking public access and HTTPS…',
		'Reviewing trust, legal, and payment signals…',
		'Inspecting preview and crawler metadata…',
		'Scanning bundles for exposed secrets and licenses…',
		'Checking repo and workflow readiness signals…',
		'Scoring advisory-gate evidence…'
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
		if (storedUrl && !url) {
			url = storedUrl;
			hydrateProjectTarget(storedUrl);
		}

		if (data.checkout === 'cancel') {
			checkoutMessage = 'Checkout canceled - your advisory evidence stays available.';
			clearCheckoutQuery();
			return;
		}

		if (data.checkout === 'success' && data.sessionId) {
			unlockSessionId = data.sessionId;
			sessionStorage.setItem(STORAGE.unlockSession, data.sessionId);
			if (storedUrl) {
				url = storedUrl;
				hydrateProjectTarget(storedUrl);
			}
			checkoutMessage = 'Subscription active - loading workspace repair guidance...';
			clearCheckoutQuery();
			if (url.trim()) void runScan(false, url);
		}

		if (data.billing === 'return') {
			checkoutMessage = 'Billing settings updated.';
			clearCheckoutQuery();
		}
	});

	$effect(() => {
		return () => {
			scanController?.abort();
			if (queryClearTimeout) clearTimeout(queryClearTimeout);
			for (const timer of copyTimeouts) clearTimeout(timer);
		};
	});

	const alphaFreeUnlock = $derived(data.alphaFreeUnlock);
	const projectReadinessTarget = $derived(deployTarget.trim() || repositoryUrl.trim());
	const projectWorkspaceQuery = $derived.by(() => {
		const params = new URLSearchParams();
		const name = projectName.trim();
		const repo = repositoryUrl.trim();
		const deploy = deployTarget.trim();
		if (name) params.set('name', name);
		if (repo) params.set('repo', repo);
		if (deploy) params.set('deploy', deploy);
		params.set('minScore', '80');
		return params.toString();
	});
	const projectWorkspaceHref = $derived(
		projectWorkspaceQuery ? `${resolve('/app')}?${projectWorkspaceQuery}` : resolve('/app')
	);

	$effect(() => {
		if (pricingTracked) return;
		pricingTracked = true;
		trackFunnel('pricing_viewed', { mode: alphaFreeUnlock ? 'alpha' : 'paid' });
	});

	function hydrateProjectTarget(target: string) {
		const trimmed = target.trim();
		if (!trimmed) return;
		if (/github\.com[:/]/i.test(trimmed)) {
			repositoryUrl ||= trimmed;
			return;
		}
		deployTarget ||= trimmed;
	}

	function clearStoredUnlockIfTargetChanged(target: string) {
		const prevUrl = sessionStorage.getItem(STORAGE.scanUrl);
		if (!prevUrl || prevUrl === target) return;
		unlockSessionId = null;
		sessionStorage.removeItem(STORAGE.unlockSession);
		sessionStorage.removeItem(STORAGE.baselineScore);
		sessionStorage.removeItem(STORAGE.baselineChecks);
	}

	function clearScanError() {
		error = null;
		errorCode = null;
		errorRetryAt = null;
	}

	function clearCheckoutQuery() {
		queryClearTimeout ??= setTimeout(() => {
			queryClearTimeout = null;
			replaceState(resolve('/'), {});
		}, 0);
	}

	function formatRetryTime(value: string | null | undefined): string | null {
		if (!value) return null;
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return null;
		return date.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZoneName: 'short'
		});
	}

	function normalizeScanApiError(status: number, body: ScanApiErrorBody | null): ScanApiError {
		const message = body?.message ?? `Scan failed (${status})`;
		const capacityReached =
			body?.code === 'daily_scan_capacity_reached' || /daily scan capacity reached/i.test(message);

		if (capacityReached) {
			const retryTime = formatRetryTime(body?.retryAt);
			return {
				code: 'daily_scan_capacity_reached',
				retryAt: body?.retryAt ?? null,
				message: retryTime
					? `The shared preview pool is full and resets at ${retryTime}. You can still generate the advisory workflow now and let CI produce the next report.`
					: 'The shared preview pool is full. You can still generate the advisory workflow now and retry the preview after the daily reset.'
			};
		}

		return { code: body?.code ?? null, message, retryAt: body?.retryAt ?? null };
	}

	async function runScan(rescan = false, target = url.trim()) {
		const scanTarget = target.trim();
		if (!scanTarget) return;
		url = scanTarget;
		scanController?.abort();
		scanController = new AbortController();
		const { signal } = scanController;

		clearScanError();
		if (!rescan) report = null;
		loading = true;
		try {
			const payload: {
				url: string;
				unlockSessionId?: string;
				previousScore?: number;
			} = { url: scanTarget };
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
				const body = (await res.json().catch(() => null)) as ScanApiErrorBody | null;
				const normalized = normalizeScanApiError(res.status, body);
				error = normalized.message;
				errorCode = normalized.code;
				errorRetryAt = normalized.retryAt;
				return;
			}
			report = (await res.json()) as ScanReport;
			sessionStorage.setItem(STORAGE.scanUrl, scanTarget);

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
						: 'Workspace repair plan active - follow the fixes below, then verify fixes.';
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
			errorCode = null;
			errorRetryAt = null;
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
		clearScanError();
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
	const subscriptionLoop = [
		{
			label: 'Monitored projects',
			value: 'Keep each deploy target, repo, and policy in one workspace.'
		},
		{
			label: 'PR advisory reports',
			value: 'Start non-blocking so every risky change gets a readable CI brief.'
		},
		{
			label: 'PR readiness history',
			value: 'Track score movement, fixed blockers, and regressions across scans.'
		},
		{
			label: 'Deploy gates',
			value: 'Turn trusted signal into a required check when the project is clean.'
		}
	] as const;
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
					href="#project-setup"
					class="rounded-xl bg-sky-500 px-5 py-3 text-center text-sm font-semibold text-zinc-950 hover:bg-sky-400"
				>
					Create monitored project
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

	<section class="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 print:hidden">
		<div class="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
			<div>
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Workspace loop</p>
				<h2 class="mt-2 text-xl font-semibold text-white">What the workspace keeps enforcing</h2>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each subscriptionLoop as item (item.label)}
					<article class="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
						<p class="text-sm font-semibold text-white">{item.label}</p>
						<p class="mt-2 text-sm leading-6 text-zinc-400">{item.value}</p>
					</article>
				{/each}
			</div>
		</div>
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
		<div class="rounded-xl border border-sky-900/60 bg-sky-950/20 p-5">
			<div class="mb-3 flex items-center justify-between gap-3">
				<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
					Workspace workflow
				</p>
				<a
					class="text-xs font-semibold text-sky-300 hover:text-sky-200"
					href={resolve('/app#install')}
				>
					Generate in workspace →
				</a>
			</div>
			<p class="text-sm leading-6 text-zinc-300">
				The install that makes Deploylint a product is project-scoped. Create the monitored project
				first, then copy the workflow with <code
					class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_PROJECT_ID</code
				> so CI reports write back to workspace history.
			</p>
			<p class="mt-3 text-sm leading-6 text-zinc-500">
				Need a no-login trial run? The developers page keeps a temporary URL-only advisory snippet,
				but it will not populate project history or gate status.
			</p>
		</div>
	</section>

	<form
		id="project-setup"
		class="mx-auto mb-10 max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 print:hidden"
		aria-label="Project profile"
		onsubmit={(e) => {
			e.preventDefault();
			window.location.href = projectWorkspaceHref;
		}}
	>
		<div class="mb-4">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Project profile</p>
			<h2 class="mt-2 text-lg font-semibold text-white">Create a monitored project</h2>
			<p class="mt-1 text-sm leading-6 text-zinc-400">
				Name the project, attach the repository, and point Deploylint at the deploy target that
				should become a monitored CI gate.
			</p>
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label for="project-name" class="mb-1.5 block text-sm font-medium text-zinc-200">
					Project name
				</label>
				<input
					id="project-name"
					type="text"
					autocomplete="organization"
					bind:value={projectName}
					placeholder="Acme control plane"
					class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="repository-url" class="mb-1.5 block text-sm font-medium text-zinc-200">
					GitHub repository
				</label>
				<input
					id="repository-url"
					type="text"
					inputmode="url"
					autocomplete="url"
					bind:value={repositoryUrl}
					placeholder="github.com/acme/app"
					class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="deploy-target" class="mb-1.5 block text-sm font-medium text-zinc-200">
					Release URL
				</label>
				<input
					id="deploy-target"
					type="url"
					inputmode="url"
					autocomplete="url"
					bind:value={deployTarget}
					required={!repositoryUrl.trim()}
					placeholder="https://app.example.com"
					class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
				/>
			</div>
		</div>
		<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<p class="text-sm leading-6 text-zinc-500">
				Release URLs get public-surface checks. GitHub repositories get repo and workflow readiness
				checks.
			</p>
			<div class="flex shrink-0 flex-col gap-2 sm:flex-row">
				<button
					type="submit"
					disabled={!projectReadinessTarget}
					class="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-500 disabled:bg-sky-900 disabled:text-sky-100"
				>
					Generate advisory workflow
				</button>
				<button
					type="button"
					disabled={loading || !projectReadinessTarget}
					class="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-white hover:border-sky-500 hover:text-sky-200 disabled:border-zinc-800 disabled:text-zinc-600"
					onclick={() => {
						const target = projectReadinessTarget;
						clearStoredUnlockIfTargetChanged(target);
						runScan(false, target);
					}}
				>
					{loading ? 'Checking...' : 'Run advisory review'}
				</button>
			</div>
		</div>
		{#if loading}
			<p class="mt-3 flex items-center gap-2 text-sm text-zinc-400" role="status">
				<span
					class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-600 border-t-sky-400"
				></span>
				{PROGRESS_STEPS[progressIdx]}
			</p>
		{/if}
		{#if error && errorCode === 'daily_scan_capacity_reached'}
			<section class="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4" role="alert">
				<p class="text-sm font-semibold text-amber-100">Shared scan capacity is full</p>
				<p class="mt-1 text-sm leading-6 text-amber-50/80">
					{error}
					{#if errorRetryAt}
						<span class="sr-only">Retry time: {errorRetryAt}</span>
					{/if}
				</p>
				<div class="mt-3 flex flex-col gap-2 sm:flex-row">
					<button
						type="button"
						class="rounded-lg bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-amber-200"
						onclick={() => {
							window.location.href = projectWorkspaceHref;
						}}
					>
						Generate advisory workflow
					</button>
					<a
						class="rounded-lg border border-amber-300/40 px-4 py-2 text-center text-sm font-semibold text-amber-100 hover:border-amber-200 hover:text-white"
						href={resolve('/developers')}
					>
						View CI setup
					</a>
				</div>
			</section>
		{:else if error}
			<p class="mt-3 text-sm text-red-400" role="alert">{error}</p>
		{/if}
		{#if checkoutMessage}
			<p class="mt-3 text-sm text-sky-300" role="status">{checkoutMessage}</p>
		{/if}
	</form>

	{#if report}
		{#await import('$lib/components/ScanReportResults.svelte') then { default: ScanReportResults }}
			<ScanReportResults
				{alphaFreeUnlock}
				{billingPortalLoading}
				{checkoutLoading}
				{copiedId}
				{loading}
				permalink={report.reportId
					? `${data.appUrl.replace(/\/$/, '')}/r/${report.reportId}`
					: null}
				{report}
				{shareCopied}
				{unlockSessionId}
				onCheckout={startCheckout}
				onCopyPrompt={copyPrompt}
				onOpenBillingPortal={openBillingPortal}
				onRescan={() => runScan(true)}
				onShare={copyShareText}
			/>
		{/await}
	{:else if !loading}
		<section class="mb-8 text-center">
			<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
				What the advisory loop checks
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
