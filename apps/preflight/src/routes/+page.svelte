<script lang="ts">
	import { resolve } from '$app/paths';
	import CiReportPreview from '$lib/components/CiReportPreview.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildDeploylintJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
			value: 'Track score movement, fixed blockers, and regressions across CI reports.'
		},
		{
			label: 'Deploy gates',
			value: 'Turn trusted signal into a required check when the project is clean.'
		}
	] as const;
	const advisoryChecks = [
		{
			title: 'Workflow hardening',
			description: 'Risky permissions, pull_request_target, floating refs, and missing CI gates.'
		},
		{
			title: 'Deploy gates',
			description: 'Advisory reports first, blocking checks only after the signal is trusted.'
		},
		{
			title: 'Repo hygiene',
			description: 'Package scripts, lockfiles, Node pins, env hygiene, and dependency signals.'
		},
		{
			title: 'Project readiness audit',
			description: 'Crawler, trust, payment, preview, license, and sell-rights evidence.'
		},
		{
			title: 'Fix evidence',
			description: 'Guided repair plans with before/after proof when the deploy path is clean.'
		},
		{
			title: 'Low-noise decisions',
			description: 'Clear blockers, advisory findings, and follow-up work instead of a vague score.'
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
					See how we compare &rarr;
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
					Generate in workspace &rarr;
				</a>
			</div>
			<p class="text-sm leading-6 text-zinc-300">
				The install that makes Deploylint a product is project-scoped. Create the monitored project
				first, then copy the workflow with <code
					class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_PROJECT_ID</code
				> so CI reports write back to workspace history.
			</p>
			<p class="mt-3 text-sm leading-6 text-zinc-500">
				Need temporary evidence before workspace setup?
				<a
					href={resolve('/review')}
					class="font-medium text-sky-300 underline underline-offset-4 hover:text-sky-200"
				>
					Preview no-login advisory evidence
				</a>
				without making it the center of the product.
			</p>
		</div>
	</section>

	<form
		id="project-setup"
		method="GET"
		action={resolve('/app')}
		class="mx-auto mb-10 max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 print:hidden"
		aria-label="Project profile"
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
					name="name"
					type="text"
					autocomplete="organization"
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
					name="repo"
					type="text"
					inputmode="url"
					autocomplete="url"
					placeholder="github.com/acme/app"
					class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
				/>
			</div>
			<div>
				<label for="deploy-target" class="mb-1.5 block text-sm font-medium text-zinc-200">
					Deploy target
				</label>
				<input
					id="deploy-target"
					name="deploy"
					type="url"
					inputmode="url"
					autocomplete="url"
					placeholder="https://app.example.com"
					class="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
				/>
			</div>
		</div>
		<input type="hidden" name="minScore" value="80" />
		<div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<p class="text-sm leading-6 text-zinc-500">
				Deploy targets add public-surface evidence. GitHub repositories add repo and workflow
				readiness checks.
			</p>
			<div class="flex shrink-0 flex-col gap-2 sm:flex-row">
				<button
					type="submit"
					class="rounded-xl bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
				>
					Generate advisory workflow
				</button>
				<a
					href={resolve('/tools/github-actions-security-checker')}
					class="rounded-xl border border-zinc-700 px-5 py-3 text-center text-sm font-semibold text-white hover:border-sky-500 hover:text-sky-200 focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none"
				>
					Check workflow YAML
				</a>
			</div>
		</div>
	</form>

	<section class="mb-8 text-center">
		<p class="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
			What the advisory loop checks
		</p>
	</section>
	<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each advisoryChecks as check (check.title)}
			<div class="rounded-xl border border-zinc-800 p-5">
				<p class="font-medium text-white">{check.title}</p>
				<p class="mt-1 text-sm text-zinc-400">{check.description}</p>
			</div>
		{/each}
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
			Compare tools &rarr;
		</a>
	</section>
</div>
