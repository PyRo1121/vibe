<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const title = buildSeoTitle('Builder DevOps tools');
	const description =
		'Deploylint tools harden GitHub Actions, deploy gates, repo hygiene, and launch workflows before risky changes hit production.';
	const canonical = $derived(`${base}/tools`);
	const jsonLd = $derived([
		buildPageJsonLd({ base, canonical, title, description, type: 'CollectionPage' })
	]);

	const tools = [
		{
			name: 'GitHub Actions Security Checker',
			href: '/tools/github-actions-security-checker',
			status: 'Live',
			description:
				'Paste workflow YAML and catch risky permissions, pull_request_target usage, floating action refs, and missing quality gates.'
		},
		{
			name: 'Deploy Gate',
			href: '/developers',
			status: 'Live',
			description:
				'Add a zero-install GitHub Actions gate that blocks deploys when production launch blockers remain.'
		},
		{
			name: 'Launch Readiness Scan',
			href: '/',
			status: 'Live',
			description:
				'Scan a live URL or public GitHub repo for launch, repo, payment, and trust issues.'
		},
		{
			name: 'Repo Hygiene Checker',
			href: '/',
			status: 'Repo scan',
			description:
				'Use the existing repo scan to check env files, lockfiles, package scripts, Node pinning, dependencies, and licenses.'
		}
	];
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-5xl px-4 py-12">
	<section class="mb-10">
		<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
			Builder DevOps tools
		</p>
		<h1 class="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
			Harden the path from pull request to production.
		</h1>
		<p class="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">
			Deploylint is pivoting into practical CI hardening, deploy gate, repo hygiene, and launch
			workflow tools. Start with the GitHub Actions checker, then wire the same rules into CI.
		</p>
	</section>

	<section class="grid gap-4 md:grid-cols-2">
		{#each tools as tool (tool.name)}
			<a
				href={tool.href}
				class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-sky-500/70 hover:bg-sky-950/20"
			>
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="text-lg font-semibold text-white">{tool.name}</h2>
					<span
						class="rounded bg-sky-500/10 px-2 py-1 text-[10px] font-bold tracking-wide text-sky-300 uppercase"
					>
						{tool.status}
					</span>
				</div>
				<p class="text-sm leading-6 text-zinc-400">{tool.description}</p>
			</a>
		{/each}
	</section>

	<section class="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
		<h2 class="text-xl font-semibold text-white">What comes next</h2>
		<p class="mt-2 text-sm leading-6 text-zinc-400">
			The first wedge is CI hardening. The broader DevOps toolbox will grow from the jobs builders
			actually use: workflow repair, deploy gates, repo hygiene, security headers, and agent-ready
			fix prompts.
		</p>
	</section>
</div>
