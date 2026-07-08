<script lang="ts">
	import { resolve } from '$app/paths';
	import { trackFunnel } from '$lib/client/track';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { DEPLOYLINT_PLAN_LIST } from '$lib/product/plans';
	import {
		buildWorkspaceCommandCenterStats,
		workspaceGateHardeningSteps,
		type ActivationStepStatus,
		type ProjectInstallState,
		type ProjectReportHistoryEntry,
		type WorkspaceBillingState
	} from '$lib/product/workspace';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { ActionData, PageData } from './$types';

	let { data, form = null }: { data: PageData; form?: ActionData } = $props();

	let workflowCopied = $state(false);
	let ingestTokenCopied = $state(false);
	let tokenRevealed = $state(false);
	let workflowCopyError = $state<string | null>(null);
	let ingestTokenCopyError = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;
	let tokenCopyTimer: ReturnType<typeof setTimeout> | null = null;
	let workspaceViewTracked = false;

	const workspace = $derived(data.workspace);
	const workspaceProjects = $derived(workspace.projects);
	const project = $derived(data.workspace.projects[0]);
	const storageUnavailable = $derived(workspace.storageStatus === 'unavailable');
	const activation = $derived(data.activation);
	const gatePolicy = $derived(data.gatePolicy);
	const latestReport = $derived(project?.latestReport ?? null);
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
	const recurringReportsEnabled = $derived(data.recurringReportsEnabled);
	const checkoutNotice = $derived(checkoutNoticeCopy(data.checkoutStatus));
	const workspaceCommandStats = $derived(buildWorkspaceCommandCenterStats(workspace));
	const commandCenterSummary = $derived(
		workspaceCommandStats.reportsThisMonth > 0
			? `${workspaceCommandStats.latestFixedCount} fixes verified, ${workspaceCommandStats.latestRegressionCount} regressions need attention across latest reports.`
			: 'Install the advisory workflow to start report history.'
	);
	const commandCenterStats = $derived([
		{
			id: 'projects',
			label: 'Monitored projects',
			value: `${workspaceCommandStats.projectsUsed}/${workspaceCommandStats.projectLimit}`,
			detail: 'Workspace capacity'
		},
		{
			id: 'gates',
			label: 'Blocking gates',
			value: String(workspaceCommandStats.gatesEnabled),
			detail: 'Enforcing deploy policy'
		},
		{
			id: 'reports',
			label: 'CI reports this month',
			value: String(workspaceCommandStats.reportsThisMonth),
			detail: 'Evidence captured'
		},
		{
			id: 'ready',
			label: 'Gate-ready projects',
			value: String(workspaceCommandStats.projectsReadyForGate),
			detail: 'Advisory projects clean enough'
		}
	]);
	const reportSummaryStats = $derived([
		{
			id: 'score',
			label: 'Score',
			value: latestReport ? String(latestReport.score) : '--',
			valueClass: 'text-2xl text-white'
		},
		{
			id: 'verdict',
			label: 'Verdict',
			value: latestReport?.verdict ?? 'Pending',
			valueClass: latestReport
				? 'mt-2 text-sm text-amber-200 uppercase'
				: 'mt-2 text-sm text-zinc-400'
		},
		{
			id: 'fixed',
			label: 'Fixed',
			value: latestReport ? String(latestReport.fixedCount) : '--',
			valueClass: 'text-2xl text-emerald-300'
		},
		{
			id: 'regressed',
			label: 'Regressed',
			value: latestReport ? String(latestReport.regressedCount) : '--',
			valueClass: 'text-2xl text-rose-300'
		}
	]);
	const title = buildSeoTitle('Project workspace');
	const description =
		'Deploylint project workspace for GitHub Actions advisory reports, deploy gates, report history, and subscription state.';
	const canonical = $derived(`${data.appUrl}/app`);
	const jsonLd = $derived([
		buildPageJsonLd({ base: data.appUrl, canonical, title, description, type: 'WebApplication' })
	]);

	$effect(() => {
		if (!workspaceViewTracked) {
			workspaceViewTracked = true;
			const mode = telemetryMode(workspace.billing.mode);
			trackFunnel('page_view', {
				mode,
				surface: 'workspace',
				source: 'browser'
			});
			trackFunnel('workspace_opened', {
				mode,
				surface: 'workspace',
				source: 'browser',
				feature: 'workspace'
			});
			if (project) {
				trackFunnel('gate_config_viewed', {
					mode,
					surface: 'workspace',
					source: 'browser',
					feature: 'gate',
					gateMode: project.gateMode
				});
			}
		}

		return () => {
			if (copyTimer) clearTimeout(copyTimer);
			if (tokenCopyTimer) clearTimeout(tokenCopyTimer);
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
		if (mode === 'alpha') return 'Free access active';
		if (mode === 'paid') return 'Billing active';
		if (mode === 'past_due') return 'Payment update needed';
		return 'Billing setup pending';
	}

	function telemetryMode(mode: WorkspaceBillingState['mode']): 'free' | 'paid' | 'workspace' {
		if (mode === 'alpha') return 'free';
		if (mode === 'paid' || mode === 'past_due') return 'paid';
		return 'workspace';
	}

	function checkoutNoticeCopy(status: PageData['checkoutStatus']) {
		if (status === 'success') {
			return {
				title: 'Checkout complete',
				body: 'Billing is activating for this workspace. Refresh in a moment if the status has not updated.',
				className: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-100'
			};
		}
		if (status === 'cancel') {
			return {
				title: 'Checkout canceled',
				body: 'No plan change was made. Start the monitoring plan again from plan and capacity.',
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

	function maskedIngestToken(token: string): string {
		if (token.length <= 10) return '********';
		return `${token.slice(0, 6)}********${token.slice(-4)}`;
	}

	async function copyWorkflow() {
		workflowCopyError = null;
		if (!hasAdvisoryWorkflow) {
			workflowCopyError = 'Create a project before copying a workflow.';
			return;
		}

		try {
			await navigator.clipboard.writeText(data.advisoryWorkflow);
			trackFunnel('workflow_copied', {
				mode: telemetryMode(workspace.billing.mode),
				surface: 'workspace',
				source: 'browser',
				feature: 'workflow',
				gateMode: project?.gateMode ?? 'advisory'
			});
			workflowCopied = true;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (workflowCopied = false), 2000);
		} catch {
			workflowCopyError = 'Copy failed. Select the workflow text manually.';
		}
	}

	async function copyIngestToken() {
		ingestTokenCopyError = null;
		if (!project?.ingestToken) {
			ingestTokenCopyError = 'Create a project before copying the workspace token.';
			return;
		}

		try {
			await navigator.clipboard.writeText(project.ingestToken);
			ingestTokenCopied = true;
			if (tokenCopyTimer) clearTimeout(tokenCopyTimer);
			tokenCopyTimer = setTimeout(() => (ingestTokenCopied = false), 2000);
		} catch {
			ingestTokenCopyError = 'Copy failed. Select the token manually.';
		}
	}
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(data.appUrl)} {jsonLd} />

<div class="mx-auto max-w-6xl px-4 py-10 text-zinc-300">
	<section class="mb-8">
		<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
					{data.projectDraftApplied ? 'Project draft applied' : 'CI command center'}
				</p>
				<h1 class="max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
					Operate deploy readiness from CI evidence.
				</h1>
				<p class="mt-3 max-w-3xl text-base leading-7 text-zinc-400">
					Track monitored projects, advisory reports, regressions, billing, and gate enforcement
					from one workspace.
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
		{#if storageUnavailable}
			<div class="mb-5 rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 text-amber-100">
				<p class="text-sm font-semibold">Workspace storage unavailable</p>
				<p class="mt-1 text-sm text-amber-100/80">
					Deploylint cannot load or create monitored projects in this environment, so workflow
					generation and billing checkout are paused until storage is connected.
				</p>
			</div>
		{/if}

		<div class="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
			<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
						CI hardening command center
					</p>
					<h2 class="mt-1 text-lg font-semibold text-white">Workspace readiness at a glance</h2>
				</div>
				<p class="text-sm text-zinc-500">{commandCenterSummary}</p>
			</div>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each commandCenterStats as stat (stat.id)}
					<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
						<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
							{stat.label}
						</p>
						<p class="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
						<p class="mt-1 text-xs leading-5 text-zinc-500">{stat.detail}</p>
					</div>
				{/each}
			</div>
		</div>

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
						<span>Gate rollout progress</span>
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
							{latestReport ? latestReport.score : '--'}
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
						Plan and capacity
					</p>
					<p class="mt-1 text-sm font-semibold text-zinc-200">
						{billingStatusLabel(workspace.billing.mode)}
					</p>
					{#if workspace.billing.mode === 'setup' && storageUnavailable}
						<p class="mt-3 text-sm leading-6 text-zinc-400">
							Connect workspace storage before starting billing or generating a project-scoped
							workflow.
						</p>
					{:else if workspace.billing.mode === 'setup'}
						<form method="POST" action={resolve('/api/workspace/checkout')} class="mt-4 space-y-3">
							<label class="block">
								<span class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
									Monitoring plan
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
								Start monitoring plan
							</button>
						</form>
					{:else if workspace.billing.mode === 'paid' || workspace.billing.mode === 'past_due'}
						<form method="POST" action={resolve('/api/workspace/billing/portal')} class="mt-4">
							<button
								type="submit"
								class="w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:border-sky-400 hover:text-sky-200 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
							>
								{workspace.billing.mode === 'past_due'
									? 'Update payment details'
									: 'Open billing portal'}
							</button>
						</form>
					{/if}
				</div>
			</aside>
		</div>
	</section>

	<section class="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
					Deploy target fleet
				</p>
				<h2 class="mt-2 text-xl font-semibold text-white">Each deploy target owns a gate path</h2>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
					Track gate mode, latest CI report quality, and gate readiness per project before expanding
					the workspace.
				</p>
			</div>
			<span class="w-fit rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
				{workspaceProjects.length} of {workspace.billing.projectLimit} slots used
			</span>
		</div>

		<div class="mt-5 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-950/40">
			{#each workspaceProjects as workspaceProject (workspaceProject.id)}
				<div class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_160px_160px_130px] lg:items-center">
					<div>
						<p class="text-sm font-semibold text-white">{workspaceProject.name}</p>
						<p class="mt-1 text-sm text-zinc-500">{workspaceProject.repoLabel}</p>
						<p class="mt-1 font-mono text-xs break-all text-zinc-600">
							{workspaceProject.deployUrl}
						</p>
					</div>
					<div>
						<p class="text-xs text-zinc-500">Gate mode</p>
						<p class="mt-1 text-sm font-medium text-zinc-200">
							{installStateLabel(workspaceProject.installState)}
						</p>
					</div>
					<div>
						<p class="text-xs text-zinc-500">Latest CI report</p>
						<p class="mt-1 text-sm font-medium text-zinc-200">
							{workspaceProject.latestReport
								? `${workspaceProject.latestReport.score} / ${workspaceProject.latestReport.verdict}`
								: 'Awaiting CI run'}
						</p>
					</div>
					<div class="lg:text-right">
						<span
							class={[
								'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
								workspaceProject.installState === 'gate_enabled'
									? 'border-emerald-500/40 text-emerald-300'
									: workspaceProject.latestReport?.verdict === 'go' &&
										  workspaceProject.latestReport.score >= workspaceProject.minScore
										? 'border-sky-500/40 text-sky-300'
										: 'border-zinc-700 text-zinc-400'
							]}
						>
							{workspaceProject.installState === 'gate_enabled'
								? 'Blocking gate'
								: workspaceProject.latestReport?.verdict === 'go' &&
									  workspaceProject.latestReport.score >= workspaceProject.minScore
									? 'Ready for blocking gate'
									: 'Advisory only'}
						</span>
					</div>
				</div>
			{:else}
				<p class="p-4 text-sm text-zinc-500">
					Create a monitored project to start CI evidence and gate tracking.
				</p>
			{/each}
		</div>
	</section>

	<section class="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
		<div id="project" class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Deploy target</p>
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
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Gate rollout</p>
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
						: recurringReportsEnabled
							? 'Advisory mode reports deploy risk on pull requests and a weekly scheduled run without failing builds. Once the signal is clean, this same project can become a blocking gate.'
							: 'Advisory mode reports deploy risk without failing builds. Once the first report is clean, this same project can become a blocking gate.'}
				</p>
				{#if recurringReportsEnabled}
					<p class="mt-2 max-w-2xl text-sm leading-6 text-sky-200">
						Weekly workspace report runs every Monday from the default branch to keep report history
						moving between pull requests.
					</p>
				{/if}
				<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
					This project-scoped workflow writes CI reports back to this workspace through
					<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_PROJECT_ID</code>
					and the
					<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_INGEST_TOKEN</code
					>
					GitHub secret.
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
		{#if project?.ingestToken}
			<div class="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
							GitHub secret
						</p>
						<p class="mt-2 text-sm leading-6 text-zinc-400">
							Add this value as
							<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300"
								>DEPLOYLINT_INGEST_TOKEN</code
							>
							before enabling workspace-backed report history.
						</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<button
							type="button"
							class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:border-sky-400 hover:text-sky-200 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
							onclick={() => (tokenRevealed = !tokenRevealed)}
						>
							{tokenRevealed ? 'Hide token' : 'Reveal token'}
						</button>
						<button
							type="button"
							class="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:border-sky-400 hover:text-sky-200 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
							onclick={copyIngestToken}
						>
							{ingestTokenCopied ? 'Copied' : 'Copy token'}
						</button>
					</div>
				</div>
				<p class="mt-3 text-xs leading-5 text-amber-200/90">
					Store this as a GitHub secret. Do not commit it.
				</p>
				<code class="mt-4 block overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-300">
					{tokenRevealed ? project.ingestToken : maskedIngestToken(project.ingestToken)}
				</code>
			</div>
		{/if}
		{#if ingestTokenCopyError}
			<p class="mt-3 text-sm text-amber-300" role="alert">{ingestTokenCopyError}</p>
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
					{latestReport ? formatReportDate(latestReport.scannedAt) : 'Awaiting first run'}
				</span>
			</div>

			<div class="mt-5 grid gap-3 sm:grid-cols-4">
				{#each reportSummaryStats as stat (stat.id)}
					<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
						<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
							{stat.label}
						</p>
						<p class={['mt-1 font-semibold', stat.valueClass]}>{stat.value}</p>
					</div>
				{/each}
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
										Fixed {report.fixedCount}
									</span>
									<span
										class="rounded-md border border-rose-500/30 px-2 py-1 text-xs text-rose-300"
									>
										Regressed {report.regressedCount}
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
