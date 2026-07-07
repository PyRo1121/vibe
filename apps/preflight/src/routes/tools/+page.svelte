<script lang="ts">
	import { resolve } from '$app/paths';
	import CiReportPreview from '$lib/components/CiReportPreview.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const title = buildSeoTitle('CI hardening tools');
	const description =
		'Deploylint tools harden GitHub Actions, deploy gates, repo hygiene, and deploy workflows before risky changes hit production.';
	const canonical = $derived(`${base}/tools`);
	const jsonLd = $derived([
		buildPageJsonLd({ base, canonical, title, description, type: 'CollectionPage' })
	]);

	const tools = [
		{
			name: 'GitHub Actions Security Checker',
			href: '/tools/github-actions-security-checker',
			status: 'Live',
			kicker: 'Workflow risk',
			description:
				'Paste workflow YAML and catch risky permissions, pull_request_target usage, floating action refs, and missing quality gates.',
			action: 'Check workflow YAML'
		},
		{
			name: 'Deploy Gate',
			href: '/developers',
			status: 'Live',
			kicker: 'CI gate',
			description:
				'Add a zero-install GitHub Actions gate that blocks deploys when configured production blockers remain.',
			action: 'Wire CI advisory'
		},
		{
			name: 'Deploy Target Audit',
			href: '/',
			status: 'Live',
			kicker: 'Secondary utility',
			description:
				'Audit a live URL or public GitHub repo for crawler, trust, payment, preview, and repo signals after CI is under control.',
			action: 'Audit target'
		},
		{
			name: 'Repo Hygiene Checker',
			href: '/',
			status: 'Repo scan',
			kicker: 'Repo hygiene',
			description:
				'Check env files, lockfiles, package scripts, Node pinning, dependency signals, and licenses.',
			action: 'Check repo'
		}
	] as const;

	const packages = [
		{
			name: 'Workflow Risk',
			description: 'Paste YAML, find risky permissions, and get a repair prompt before merge.'
		},
		{
			name: 'Advisory PR Report',
			description: 'Run in GitHub Actions without blocking builds while the team calibrates signal.'
		},
		{
			name: 'Deploy Gate',
			description: 'Fail risky deploys only after the advisory report is clean and trusted.'
		},
		{
			name: 'Repo Hygiene',
			description:
				'Catch scripts, lockfiles, runtime pins, env mistakes, licenses, and dependency risk.'
		}
	];
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-5xl px-4 py-12">
	<section class="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
		<div>
			<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
				Marketable package
			</p>
			<h1 class="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
				One adoption loop for safer agent-built deploys.
			</h1>
			<p class="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">
				Deploylint is not a random toolbox. It is a CI hardening loop: review workflow risk, add an
				advisory PR report, fix the highest-risk findings, then turn clean signal into a deploy
				gate.
			</p>
			<div class="mt-6 flex flex-col gap-3 sm:flex-row">
				<a
					href={resolve('/developers')}
					class="rounded-xl bg-sky-500 px-5 py-3 text-center text-sm font-semibold text-zinc-950 hover:bg-sky-400"
				>
					Install in GitHub Actions
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

	<section class="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each packages as item (item.name)}
			<article class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
				<p class="font-semibold text-white">{item.name}</p>
				<p class="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
			</article>
		{/each}
	</section>

	<section class="mb-6">
		<a
			href={resolve(tools[0].href)}
			class="block rounded-xl border border-sky-500/40 bg-sky-950/20 p-6 transition hover:border-sky-400 hover:bg-sky-950/30"
		>
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
						{tools[0].kicker}
					</p>
					<h2 class="mt-3 text-2xl font-semibold tracking-tight text-white">{tools[0].name}</h2>
					<p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">{tools[0].description}</p>
				</div>
				<span
					class="w-fit rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold whitespace-nowrap text-zinc-950"
				>
					{tools[0].action}
				</span>
			</div>
		</a>
	</section>

	<section class="grid gap-4 md:grid-cols-3">
		{#each tools.slice(1) as tool (tool.name)}
			<a
				href={resolve(tool.href)}
				class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-sky-500/70 hover:bg-sky-950/20"
			>
				<div class="mb-4 flex items-center justify-between gap-3">
					<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">{tool.kicker}</p>
					<span
						class="rounded bg-sky-500/10 px-2 py-1 text-[10px] font-bold tracking-wide text-sky-300 uppercase"
					>
						{tool.status}
					</span>
				</div>
				<h2 class="text-lg font-semibold text-white">{tool.name}</h2>
				<p class="mt-3 text-sm leading-6 text-zinc-400">{tool.description}</p>
				<p class="mt-4 text-sm font-semibold text-sky-300">{tool.action} &rarr;</p>
			</a>
		{/each}
	</section>

	<section class="mt-10 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
		<div class="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
			<div>
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">What comes next</p>
				<h2 class="mt-2 text-xl font-semibold text-white">A tighter DevOps toolbox</h2>
			</div>
			<div class="grid gap-4 text-sm leading-6 text-zinc-400 sm:grid-cols-3">
				<p>
					<span class="block font-semibold text-white">Workflow repair</span>
					Actionable prompts and fixed workflow snippets for risky CI files.
				</p>
				<p>
					<span class="block font-semibold text-white">Deploy gates</span>
					Advisory first, then blocking only when the signal is proven clean.
				</p>
				<p>
					<span class="block font-semibold text-white">Repo hygiene</span>
					Package scripts, lockfiles, env safety, dependencies, and security headers.
				</p>
			</div>
		</div>
	</section>
</div>
