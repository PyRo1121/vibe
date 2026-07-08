<script lang="ts">
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { DEPLOYLINT_PLAN_LIST } from '$lib/product/plans';
	import {
		workspaceGateHardeningSteps,
		type ActivationStepStatus,
		type ProjectInstallState,
		type ProjectReportHistoryEntry,
		type ProjectReportSummary,
		type WorkspaceBillingState
	} from '$lib/product/workspace';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { ActionData, PageData } from './$types';

	let { data, form = null }: { data: PageData; form?: ActionData } = $props();

	let workflowCopied = $state(false);
	let workflowCopyError = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	const workspace = $derived(data.workspace);
	const project = $derived(data.workspace.projects[0]);
	const activation = $derived(data.activation);
	const gatePolicy = $derived(data.gatePolicy);
	const pendingReport: ProjectReportSummary = {
		id: 'report_pending',
		score: 86,
		verdict: 'conditional',
		scannedAt: 'After first CI run',
		fixedCount: 5,
		regressedCount: 1
	};
	const latestReport = $derived(project?.latestReport ?? pendingReport);
	const reportHistory = $derived(project?.reportHistory ?? []);
	const latestHistoryEntry = $derived(reportHistory[0] ?? null);
	const previousHistoryEntry = $derived(reportHistory[1] ?? null);
	const scoreDelta = $derived(
		latestHistoryEntry && previousHistoryEntry
			? latestHistoryEntry.score - previousHistoryEntry.score
			: null
	);
	const awaitingFirstReport = $derived(!project?.latestReport);
	const gateEnabled = $derived(
		project?.installState === 'gate_enabled' && project.gateMode === 'gate'
	);
	const latestReportMeetsGate = $derived(
		Boolean(
			project?.latestReport?.verdict === 'go' && project.latestReport.score >= project.minScore
		)
	);
	const gatePromotionReady = $derived(
		Boolean(
			project &&
			!gateEnabled &&
			project.installState === 'advisory_installed' &&
			latestReportMeetsGate
		)
	);
	const progressLabel = $derived(
		`${activation.progress.completed}/${activation.progress.total} complete`
	);
	const hasAdvisoryWorkflow = $derived(data.advisoryWorkflow.trim().length > 0);
	const checkoutNotice = $derived(checkoutNoticeCopy(data.checkoutStatus));
	const title = buildSeoTitle('Project workspace');
	const description =
		'Deploylint project workspace for GitHub Actions advisory reports, deploy gates, report history, and subscription state.';
	const canonical = $derived(`${data.appUrl}/app`);
	const jsonLd = $derived([
		buildPageJsonLd({ base: data.appUrl, canonical, title, description, type: 'WebApplication' })
	]);

	$effect(() => {
		return () => {
			if (copyTimer) clearTimeout(copyTimer);
		};
	});

	function activationBadgeClass(status: ActivationStepStatus): string {
		if (status === 'complete') return 'border-emerald-500/50 text-emerald-300 bg-emerald-950/30';
		if (status === 'current') return 'border-sky-500/60 text-sky-300 bg-sky-950/40';
		return 'border-zinc-700 text-zinc-500 bg-zinc-950/40';
	}

	function activationStatusLabel(status: ActivationStepStatus): string {
		if (status === 'complete') return 'Complete';
		if (status === 'current') return 'Current';
		return 'Locked';
	}

	function installStateLabel(state: ProjectInstallState | undefined): string {
		if (state === 'advisory_installed') return 'Advisory installed';
		if (state === 'gate_enabled') return 'Gate enabled';
		return 'Advisory not installed';
	}

	function installStateClass(state: ProjectInstallState | undefined): string {
		if (state === 'gate_enabled') return 'border-emerald-500/40 text-emerald-200';
		if (state === 'advisory_installed') return 'border-sky-500/40 text-sky-200';
		return 'border-amber-500/40 text-amber-200';
	}

	function billingStatusLabel(mode: WorkspaceBillingState['mode']): string {
		if (mode === 'alpha') return 'Included during alpha';
		if (mode === 'paid') return 'Billing active';
		return 'Billing setup pending';
	}

	function checkoutNoticeCopy(status: PageData['checkoutStatus']) {
		if (status === 'success') {
			return {
				title: 'Checkout complete',
				body: 'Billing will switch to active as soon as the signed Stripe webhook updates this workspace.',
				className: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100'
			};
		}
		if (status === 'cancel') {
			return {
				title: 'Checkout canceled',
				body: 'No plan change was made. Workspace billing can be started again from the billing status panel.',
				className: 'border-amber-500/30 bg-amber-950/20 text-amber-100'
			};
		}
		return null;
	}

	function gateModeLabel(): string {
		if (gateEnabled) return 'Blocking gate';
		if (project?.installState === 'advisory_installed') return 'Advisory report';
		return 'Not installed';
	}

	function gatePromotionHint(): string {
		if (!project) return 'Create a project before enabling gate mode.';
		if (gateEnabled) return 'The generated workflow now uses gate mode.';
		if (project.installState !== 'advisory_installed') return 'Install the workflow first.';
		if (!project.latestReport) return 'Run the first advisory CI report before promotion.';
		if (project.latestReport.verdict !== 'go')
			return 'Resolve blockers until the latest verdict is GO.';
		if (project.latestReport.score < project.minScore) {
			return `Raise the latest score to ${project.minScore} before enabling gate mode.`;
		}
		return 'Latest advisory report is clean enough to enable blocking gate mode.';
	}

	function formatReportDate(value: string): string {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleString();
	}

	function shortCommit(value: string | null): string | null {
		return value ? value.slice(0, 7) : null;
	}

	function reportContext(report: ProjectReportHistoryEntry): string {
		const parts = [
			report.branch ? `Branch ${report.branch}` : null,
			report.pullRequest ? `PR #${report.pullRequest}` : null,
			shortCommit(report.commitSha)
		].filter(Boolean);
		return parts.join(' · ') || 'CI context not recorded';
	}

	function scoreDeltaLabel(delta: number | null): string {
		if (delta == null) return 'Need second run';
		if (delta > 0) return `+${delta} since prior run`;
		if (delta < 0) return `${delta} since prior run`;
		return 'No score change';
	}

	function scoreDeltaClass(delta: number | null): string {
		if (delta == null) return 'border-zinc-700 text-zinc-400';
		if (delta > 0) return 'border-emerald-500/40 text-emerald-300';
		if (delta < 0) return 'border-rose-500/40 text-rose-300';
		return 'border-zinc-700 text-zinc-300';
	}

	async function copyWorkflow() {
		workflowCopyError = null;
		if (!hasAdvisoryWorkflow) {
			workflowCopyError = 'Create a project before copying a workflow.';
			return;
		}

		try {
			await navigator.clipboard.writeText(data.advisoryWorkflow);
			workflowCopied = true;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (workflowCopied = false), 2000);
		} catch {
			workflowCopyError = 'Copy failed. Select the workflow text manually.';
		}
	}
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(data.appUrl)} {jsonLd} />

<div class="mx-auto max-w-6xl px-4 py-10 text-zinc-300">
	<section class="mb-8">
		<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
					{data.projectDraftApplied ? 'Project draft applied' : 'Setup checklist'}
				</p>
				<h1 class="max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
					Turn a workflow check into a deploy gate.
				</h1>
				<p class="mt-3 max-w-3xl text-base leading-7 text-zinc-400">
					Deploylint is organized around monitored projects, CI reports, and gate enforcement. Start
					advisory, prove the signal, then switch on blocking.
				</p>
			</div>
			<p class="text-sm text-zinc-500">
				Signed in as <span class="text-zinc-300">{data.user.email}</span>
			</p>
		</div>

		{#if checkoutNotice}
			<div class={`mb-5 rounded-lg border p-4 ${checkoutNotice.className}`}>
				<p class="text-sm font-semibold">{checkoutNotice.title}</p>
				<p class="mt-1 text-sm opacity-80">{checkoutNotice.body}</p>
			</div>
		{/if}

		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
			<div class="rounded-xl border border-sky-500/30 bg-sky-950/20 p-5">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">Next action</p>
						<h2 class="mt-2 text-2xl font-semibold text-white">
							{activation.nextAction.label}
						</h2>
						<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
							{activation.nextAction.description}
						</p>
					</div>
					<a
						href={resolve(`/app${activation.nextAction.href}`)}
						class="rounded-lg bg-sky-500 px-4 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-sky-400 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
					>
						{activation.nextAction.ctaLabel}
					</a>
				</div>
				<div class="mt-5">
					<div class="mb-2 flex items-center justify-between text-xs text-zinc-400">
						<span>Activation progress</span>
						<span>{progressLabel}</span>
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-zinc-800">
						<div
							class="h-full rounded-full bg-sky-400"
							style={`width: ${activation.progress.percentage}%`}
						></div>
					</div>
				</div>
			</div>

			<aside class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
					{workspace.ownerLabel}
				</p>
				<h2 class="mt-2 text-xl font-semibold text-white">{workspace.billing.planLabel}</h2>
				<p class="mt-2 text-sm leading-6 text-zinc-400">
					This workspace includes {workspace.metrics.activeProjects}/{workspace.billing
						.projectLimit}
					monitored projects, readiness reports, report history, and deploy gate enforcement.
				</p>
				<div class="mt-5 grid grid-cols-3 gap-2">
					<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
						<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
							Gate mode
						</p>
						<p class="mt-1 text-sm font-semibold text-white">{gateModeLabel()}</p>
					</div>
					<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
						<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
							Last score
						</p>
						<p class="mt-1 text-lg font-semibold text-white">
							{awaitingFirstReport ? '--' : latestReport.score}
						</p>
					</div>
					<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
						<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Reports</p>
						<p class="mt-1 text-lg font-semibold text-white">
							{workspace.metrics.reportsThisMonth}
						</p>
					</div>
				</div>
				<p class="mt-3 text-xs text-zinc-500">
					{workspace.metrics.gatesEnabled} blocking gates enabled across this workspace.
				</p>
				<div class="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
					<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
						Billing status
					</p>
					<p class="mt-1 text-sm font-semibold text-zinc-200">
						{billingStatusLabel(workspace.billing.mode)}
					</p>
					{#if workspace.billing.mode === 'setup'}
						<form method="POST" action={resolve('/api/workspace/checkout')} class="mt-4 space-y-3">
							<label class="block">
								<span class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
									Plan
								</span>
								<select
									name="plan"
									class="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30 focus:outline-none"
								>
									{#each DEPLOYLINT_PLAN_LIST as plan (plan.id)}
										<option value={plan.id}>{plan.name} - {plan.priceLabel}</option>
									{/each}
								</select>
							</label>
							<button
								type="submit"
								class="w-full rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-sky-300 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
							>
								Start workspace billing
							</button>
						</form>
					{:else if workspace.billing.mode === 'paid'}
						<form method="POST" action={resolve('/api/workspace/billing/portal')} class="mt-4">
							<button
								type="submit"
								class="w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:border-sky-400 hover:text-sky-200 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
							>
								Manage billing
							</button>
						</form>
					{/if}
				</div>
			</aside>
		</div>
	</section>

	<section class="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
		<div id="project" class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Project setup</p>
					<h2 class="mt-2 text-2xl font-semibold text-white">
						{project?.name ?? 'Create your first monitored project'}
					</h2>
					<p class="mt-2 text-sm text-zinc-400">
						{project?.repoLabel ?? 'Connect a repository to generate a workspace-backed workflow.'}
					</p>
				</div>
				<span
					class={[
						'w-fit rounded-full border px-3 py-1 text-xs',
						installStateClass(project?.installState)
					]}
				>
					{installStateLabel(project?.installState)}
				</span>
			</div>

			<div class="mt-6 grid gap-4 sm:grid-cols-4">
				<div>
					<p class="text-xs text-zinc-500">Deploy target</p>
					<p class="mt-1 font-mono text-sm break-all text-zinc-200">
						{project?.deployUrl ?? 'Not set'}
					</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Workflow</p>
					<p class="mt-1 font-mono text-sm break-all text-zinc-200">
						{project?.workflowPath ?? '.github/workflows/deploylint.yml'}
					</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Mode</p>
					<p class="mt-1 text-sm font-medium text-zinc-200">{project?.gateMode ?? 'advisory'}</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Minimum score</p>
					<p class="mt-1 text-sm font-medium text-zinc-200">{project?.minScore ?? 80}</p>
				</div>
			</div>
		</div>

		<aside class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Activation</p>
			<ol class="mt-4 space-y-4">
				{#each activation.steps as step, index (step.id)}
					<li class="flex gap-3">
						<span
							class={[
								'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
								activationBadgeClass(step.status)
							]}
							aria-label={activationStatusLabel(step.status)}
						>
							{index + 1}
						</span>
						<span>
							<span class="block text-sm font-semibold text-white">{step.label}</span>
							<span class="mt-1 block text-sm leading-5 text-zinc-500">{step.description}</span>
						</span>
					</li>
				{/each}
			</ol>
		</aside>
	</section>

	<section id="install" class="mb-8 rounded-xl border border-sky-900/50 bg-sky-950/20 p-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
					Install in GitHub Actions
				</p>
				<h2 class="mt-2 text-xl font-semibold text-white">
					{gateEnabled ? 'Blocking gate workflow' : 'Start in advisory mode'}
				</h2>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
					{gateEnabled
						? 'This workflow now fails risky deploy changes when the score, verdict, or blocker policy does not pass.'
						: 'Advisory mode reports deploy risk without failing builds. Once the first report is clean, this same project can become a blocking gate.'}
				</p>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
					This project-scoped workflow writes CI reports back to this workspace through
					<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_PROJECT_ID</code>.
				</p>
			</div>
			<button
				type="button"
				class="rounded-lg border border-sky-500/50 px-4 py-2 text-sm font-semibold text-sky-200 hover:border-sky-400 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
				onclick={copyWorkflow}
				disabled={!hasAdvisoryWorkflow}
			>
				{workflowCopied ? 'Copied' : 'Copy workflow'}
			</button>
		</div>
		{#if workflowCopyError}
			<p class="mt-3 text-sm text-amber-300" role="alert">{workflowCopyError}</p>
		{/if}
		{#if hasAdvisoryWorkflow}
			<pre
				class="mt-5 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
					>{data.advisoryWorkflow}</code
				></pre>
		{:else}
			<p class="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
				Create a monitored project before generating a workspace-backed GitHub Actions workflow.
			</p>
		{/if}
	</section>

	<section class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
		<div id="reports" class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
						Report history
					</p>
					<h2 class="mt-2 text-xl font-semibold text-white">
						{awaitingFirstReport ? 'Awaiting first CI report' : 'Latest CI report'}
					</h2>
					<p class="mt-2 text-sm leading-6 text-zinc-400">
						{awaitingFirstReport
							? 'Install the advisory workflow and this becomes live project history with scores, regressions, and CI context.'
							: 'Deploylint keeps recent project reports attached to the workspace so every PR can prove what changed.'}
					</p>
				</div>
				<span
					class="w-fit rounded-full border border-sky-500/40 bg-sky-950/30 px-3 py-1 text-xs font-semibold text-sky-200"
				>
					{awaitingFirstReport ? 'Awaiting first run' : formatReportDate(latestReport.scannedAt)}
				</span>
			</div>

			<div class="mt-5 grid gap-3 sm:grid-cols-4">
				<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
					<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Score</p>
					<p class="mt-1 text-2xl font-semibold text-white">{latestReport.score}</p>
				</div>
				<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
					<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Verdict</p>
					<p class="mt-2 text-sm font-semibold text-amber-200 uppercase">{latestReport.verdict}</p>
				</div>
				<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
					<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Fixed</p>
					<p class="mt-1 text-2xl font-semibold text-emerald-300">{latestReport.fixedCount}</p>
				</div>
				<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
					<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Regressed</p>
					<p class="mt-1 text-2xl font-semibold text-rose-300">{latestReport.regressedCount}</p>
				</div>
			</div>

			{#if awaitingFirstReport}
				<div class="mt-5 rounded-lg border border-amber-500/30 bg-amber-950/10 p-4">
					<p class="text-xs font-semibold tracking-widest text-amber-200 uppercase">
						History starts after CI
					</p>
					<p class="mt-2 text-sm leading-6 text-zinc-300">
						The first advisory run will attach score, verdict, fixed/regressed counts, branch,
						commit, PR, and report links to this project.
					</p>
				</div>
			{:else}
				<div class="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
								Readiness trend
							</p>
							<p class="mt-1 text-sm text-zinc-400">
								Recent CI reports with branch, PR, commit, and deploy target evidence.
							</p>
						</div>
						<span
							class={['w-fit rounded-full border px-3 py-1 text-xs', scoreDeltaClass(scoreDelta)]}
						>
							{scoreDeltaLabel(scoreDelta)}
						</span>
					</div>

					<ol class="mt-4 divide-y divide-zinc-800">
						{#each reportHistory as report, index (report.id)}
							<li class="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_160px] sm:items-center">
								<div>
									<p class="text-sm font-semibold text-white">
										{index === 0 ? 'Latest report' : `Run ${index + 1}`}
										<span class="ml-2 font-normal text-zinc-500"
											>{formatReportDate(report.scannedAt)}</span
										>
									</p>
									<p class="mt-1 text-sm text-zinc-400">{reportContext(report)}</p>
									<p class="mt-1 font-mono text-xs break-all text-zinc-600">{report.finalUrl}</p>
								</div>
								<div class="flex flex-wrap items-center gap-2 sm:justify-end">
									<span class="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300">
										Score {report.score}
									</span>
									<span class="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300">
										{report.verdict}
									</span>
									<span
										class="rounded-md border border-emerald-500/30 px-2 py-1 text-xs text-emerald-300"
									>
										+{report.fixedCount}
									</span>
									<span
										class="rounded-md border border-rose-500/30 px-2 py-1 text-xs text-rose-300"
									>
										-{report.regressedCount}
									</span>
									{#if report.reportId}
										<a
											class="rounded-md border border-sky-500/40 px-2 py-1 text-xs font-semibold text-sky-300 hover:border-sky-300 hover:text-sky-100"
											href={resolve(`/r/${report.reportId}`)}
										>
											Open brief
										</a>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				</div>
			{/if}
		</div>

		<aside class="space-y-6">
			<div id="gate" class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Gate status</p>
				<h2 class="mt-2 text-xl font-semibold text-white">
					{project?.gateMode === 'gate' ? 'Blocking gate enabled' : 'Advisory mode first'}
				</h2>
				<p class="mt-2 text-sm leading-6 text-zinc-400">
					Start non-blocking so the team can trust the signal. When reports are clean, switch to a
					blocking deploy gate that fails risky production changes.
				</p>
				{#if gatePolicy}
					<div class="mt-5 border-t border-zinc-800 pt-5">
						<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Gate policy</p>
						<h3 class="mt-2 text-base font-semibold text-white">
							Required check: {gatePolicy.checkName}
						</h3>
						<p class="mt-2 text-sm leading-6 text-zinc-400">
							Score below {gatePolicy.minScore}, a NO-GO verdict, or a P0 blocker fails once
							<code class="text-sky-300">DEPLOYLINT_MODE</code> is set to gate.
						</p>
						<dl class="mt-4 grid gap-3 text-sm">
							<div>
								<dt class="text-xs text-zinc-500">Mode</dt>
								<dd class="mt-1 font-medium text-zinc-200">{gatePolicy.enforcementLabel}</dd>
							</div>
							<div>
								<dt class="text-xs text-zinc-500">Required env</dt>
								<dd class="mt-2 flex flex-wrap gap-2">
									{#each gatePolicy.requiredEnvVars as envVar (envVar)}
										<code
											class="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-sky-300"
										>
											{envVar}
										</code>
									{/each}
								</dd>
							</div>
						</dl>
						<ul class="mt-4 space-y-2 text-sm leading-5 text-zinc-500">
							{#each gatePolicy.blocks as blocker (blocker)}
								<li>{blocker}</li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if form?.enableGateError}
					<p
						class="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-200"
						role="alert"
					>
						{form.enableGateError}
					</p>
				{/if}
				{#if form?.gateEnabled || gateEnabled}
					<p
						class="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm text-emerald-200"
					>
						Blocking gate mode is enabled for this project. Copy the workflow again so GitHub
						Actions uses <code>DEPLOYLINT_MODE: gate</code>.
					</p>
				{:else if project}
					<form method="POST" action="?/enableGate" class="mt-5">
						<input type="hidden" name="projectId" value={project.id} />
						<button
							type="submit"
							class="w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
							disabled={!gatePromotionReady}
						>
							Enable blocking gate
						</button>
						<p class="mt-2 text-xs leading-5 text-zinc-500">{gatePromotionHint()}</p>
					</form>
				{/if}
				<a
					href={resolve('/developers')}
					class="mt-5 inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:border-sky-500 hover:text-sky-200 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
				>
					View gate docs
				</a>
			</div>

			<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
					Branch protection handoff
				</p>
				<h2 class="mt-2 text-xl font-semibold text-white">
					Make the check required only after trust
				</h2>
				<p class="mt-2 text-sm leading-6 text-zinc-400">
					After the advisory job is trusted, make Deploylint a required status check in branch
					protection, then enable blocking gate mode from this workspace.
				</p>
				<ol class="mt-4 space-y-3">
					{#each workspaceGateHardeningSteps as step, index (step.id)}
						<li class="flex gap-3">
							<span
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xs font-semibold text-zinc-400"
							>
								{index + 1}
							</span>
							<span>
								<span class="block text-sm font-semibold text-zinc-200">{step.label}</span>
								<span class="mt-1 block text-sm leading-5 text-zinc-500">{step.description}</span>
							</span>
						</li>
					{/each}
				</ol>
			</div>
		</aside>
	</section>
</div>
