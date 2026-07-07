<script lang="ts">
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import type { ActivationStepStatus, ProjectInstallState } from '$lib/product/workspace';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let workflowCopied = $state(false);
	let workflowCopyError = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;

	const workspace = $derived(data.workspace);
	const project = $derived(data.workspace.projects[0]);
	const activation = $derived(data.activation);
	const progressLabel = $derived(
		`${activation.progress.completed}/${activation.progress.total} complete`
	);
	const hasAdvisoryWorkflow = $derived(data.advisoryWorkflow.trim().length > 0);
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
					Activation command center
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
					Solo includes {workspace.billing.projectLimit} monitored project, advisory reports, report history,
					and deploy gate enforcement.
				</p>
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
						{project?.repoLabel ?? 'Connect a repository in the next setup loop.'}
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
				<h2 class="mt-2 text-xl font-semibold text-white">Start in advisory mode</h2>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
					Advisory mode reports deploy risk without failing builds. Once the first report is clean,
					this same project can become a blocking gate.
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

	<section class="grid gap-6 lg:grid-cols-2">
		<div id="reports" class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Report history</p>
			<h2 class="mt-2 text-xl font-semibold text-white">No CI reports yet</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Install the advisory workflow and open a pull request. This area becomes the project report
				history with scores, blockers, regressions, and the recommended next fix.
			</p>
		</div>

		<div id="gate" class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Gate status</p>
			<h2 class="mt-2 text-xl font-semibold text-white">
				{project?.gateMode === 'gate' ? 'Blocking gate enabled' : 'Advisory mode first'}
			</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Start non-blocking so the team can trust the signal. When reports are clean, switch to a
				blocking deploy gate that fails risky production changes.
			</p>
			<a
				href={resolve('/developers')}
				class="mt-4 inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:border-sky-500 hover:text-sky-200 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
			>
				View gate docs
			</a>
		</div>
	</section>
</div>
