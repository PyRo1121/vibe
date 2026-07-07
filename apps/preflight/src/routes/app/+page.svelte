<script lang="ts">
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { workspaceActivationSteps } from '$lib/product/workspace';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const workspace = $derived(data.workspace);
	const project = $derived(data.workspace.projects[0]);
	const title = buildSeoTitle('Project workspace');
	const description =
		'Deploylint project workspace for GitHub Actions advisory reports, deploy gates, report history, and subscription state.';
	const canonical = $derived(`${data.appUrl}/app`);
	const jsonLd = $derived([
		buildPageJsonLd({ base: data.appUrl, canonical, title, description, type: 'WebApplication' })
	]);
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(data.appUrl)} {jsonLd} />

<div class="mx-auto max-w-6xl px-4 py-10 text-zinc-300">
	<section class="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
		<div>
			<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
				Project workspace
			</p>
			<h1 class="max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
				Turn a workflow check into an installed deploy gate.
			</h1>
			<p class="mt-4 max-w-3xl text-base leading-7 text-zinc-400 sm:text-lg">
				This is the product home for Deploylint: project install state, first advisory report,
				report history, subscription status, and the path from advisory mode to blocking gate.
			</p>
			<p class="mt-3 text-sm text-zinc-500">
				Signed in as <span class="text-zinc-300">{data.user.email}</span>
			</p>
			<div class="mt-6 flex flex-col gap-3 sm:flex-row">
				<a
					href={resolve('/app#install')}
					class="rounded-xl bg-sky-500 px-5 py-3 text-center text-sm font-semibold text-zinc-950 hover:bg-sky-400"
				>
					Install in GitHub Actions
				</a>
				<a
					href={resolve('/developers')}
					class="rounded-xl border border-zinc-700 px-5 py-3 text-center text-sm font-semibold text-white hover:border-sky-500 hover:text-sky-200"
				>
					View gate docs
				</a>
			</div>
		</div>

		<aside class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
				{workspace.ownerLabel}
			</p>
			<h2 class="mt-2 text-xl font-semibold text-white">{workspace.billing.planLabel}</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				{workspace.billing.projectLimit} monitored project included. Billing will attach here instead
				of to a single scanned URL.
			</p>
		</aside>
	</section>

	<section class="mb-8 grid gap-4 md:grid-cols-3">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Projects</p>
			<p class="mt-2 text-3xl font-semibold text-white">{workspace.metrics.activeProjects}</p>
			<p class="mt-2 text-sm text-zinc-400">Active CI installs with reports received.</p>
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Reports</p>
			<p class="mt-2 text-3xl font-semibold text-white">{workspace.metrics.reportsThisMonth}</p>
			<p class="mt-2 text-sm text-zinc-400">Advisory or gate reports this month.</p>
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Gates</p>
			<p class="mt-2 text-3xl font-semibold text-white">{workspace.metrics.gatesEnabled}</p>
			<p class="mt-2 text-sm text-zinc-400">Projects currently blocking risky deploys.</p>
		</div>
	</section>

	<section class="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
						Current project
					</p>
					<h2 class="mt-2 text-2xl font-semibold text-white">{project.name}</h2>
					<p class="mt-2 text-sm text-zinc-400">{project.repoLabel}</p>
				</div>
				<span
					class="w-fit rounded-full border border-amber-500/40 px-3 py-1 text-xs text-amber-200"
				>
					{project.installState === 'not_installed' ? 'Not installed' : project.installState}
				</span>
			</div>

			<div class="mt-6 grid gap-4 sm:grid-cols-3">
				<div>
					<p class="text-xs text-zinc-500">Deploy target</p>
					<p class="mt-1 font-mono text-sm text-zinc-200">{project.deployUrl}</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Mode</p>
					<p class="mt-1 text-sm font-medium text-zinc-200">{project.gateMode}</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Minimum score</p>
					<p class="mt-1 text-sm font-medium text-zinc-200">{project.minScore}</p>
				</div>
			</div>

			<div class="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
				<p class="font-semibold text-white">First advisory report</p>
				<p class="mt-2 text-sm leading-6 text-zinc-400">
					No CI report has been received yet. Install the advisory workflow below, open a pull
					request, and this panel becomes report history instead of another scanner result.
				</p>
			</div>
		</div>

		<aside class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Activation</p>
			<ol class="mt-4 space-y-4">
				{#each workspaceActivationSteps as step, index (step.id)}
					<li class="flex gap-3">
						<span
							class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-500/50 text-xs font-semibold text-sky-300"
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

	<section id="install" class="rounded-xl border border-sky-900/50 bg-sky-950/20 p-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
					Install in GitHub Actions
				</p>
				<h2 class="mt-2 text-xl font-semibold text-white">Start in advisory mode</h2>
			</div>
			<p class="max-w-sm text-sm leading-6 text-zinc-400">
				This workflow is project-scoped with
				<code class="rounded bg-zinc-950 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_PROJECT_ID</code>,
				so future reports can attach to this workspace.
			</p>
		</div>
		<pre
			class="mt-5 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{data.advisoryWorkflow}</code
			></pre>
	</section>
</div>
