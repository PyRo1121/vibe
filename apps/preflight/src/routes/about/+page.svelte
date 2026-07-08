<script lang="ts">
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import {
		buildDeploylintJsonLd,
		buildPageJsonLd,
		buildSeoTitle,
		defaultSeoImage
	} from '$lib/site/seo-metadata';

	const base = 'https://deploylint.com';
	const title = buildSeoTitle('About Deploylint');
	const description =
		'Deploylint builds CI hardening, deploy gate, repo hygiene, and launch workflow tools for builders shipping with GitHub Actions and AI coding agents.';
	const canonical = `${base}/about`;
	const jsonLd = [
		...buildDeploylintJsonLd({ base, description, price: '0.00' }),
		buildPageJsonLd({ base, canonical, title, description, type: 'AboutPage' })
	];
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<article class="mx-auto max-w-3xl px-4 py-12 text-zinc-300">
	<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
		Builder DevOps, not another audit score
	</p>
	<h1 class="mb-4 text-3xl font-bold text-white sm:text-4xl">About Deploylint</h1>
	<p class="mb-8 text-lg leading-8 text-zinc-400">
		Deploylint helps builders harden the path from pull request to production. The toolbox starts
		with GitHub Actions security checks, deploy gates, repo hygiene, and public release URL reviews.
	</p>

	<section class="mb-10">
		<h2 class="mb-3 text-xl font-semibold text-white">What Deploylint is for</h2>
		<p class="leading-7 text-zinc-400">
			The product is built for developers shipping fast with GitHub Actions, Cloudflare, Vercel,
			Cursor, Claude Code, and similar tools. The practical question is simple: will this workflow
			or deploy path let risky changes reach production?
		</p>
	</section>

	<section class="mb-10">
		<h2 class="mb-3 text-xl font-semibold text-white">What it checks</h2>
		<ul class="list-disc space-y-2 pl-6 leading-7 text-zinc-400">
			<li>GitHub Actions permissions, pull_request_target hazards, and floating action refs</li>
			<li>Missing lint, typecheck, test, and build gates before deploy jobs</li>
			<li>Repo hygiene such as committed env files, lockfiles, scripts, and runtime pins</li>
			<li>
				SEO blockers such as noindex, robots.txt mistakes, missing canonicals, and thin metadata
			</li>
			<li>Broken Open Graph and X/Twitter preview images before links are shared</li>
			<li>
				Exposed secrets, public dotfiles, source maps, weak headers, and security.txt readiness
			</li>
			<li>Missing privacy, terms, trust, and launch-safety surfaces</li>
			<li>
				GitHub Actions, dependency, and CI gate signals for teams that want automated blocking
			</li>
		</ul>
	</section>

	<section class="mb-10">
		<h2 class="mb-3 text-xl font-semibold text-white">How it is different</h2>
		<p class="leading-7 text-zinc-400">
			Deploylint does not try to replace enterprise AppSec, Lighthouse, or full observability
			stacks. It turns common builder DevOps mistakes into clear findings, fixed snippets, and
			agent-ready repair prompts that can be used before a deploy ships.
		</p>
	</section>

	<p>
		<a class="text-sky-400 hover:underline" href={resolve('/tools')}>Browse tools</a>
		<span class="mx-2 text-zinc-600">&middot;</span>
		<a class="text-sky-400 hover:underline" href={resolve('/tools/github-actions-security-checker')}
			>Check GitHub Actions</a
		>
		<span class="mx-2 text-zinc-600">&middot;</span>
		<a class="text-sky-400 hover:underline" href={resolve('/')}>Start release-readiness review</a>
		<span class="mx-2 text-zinc-600">&middot;</span>
		<a class="text-sky-400 hover:underline" href={resolve('/checks')}>Browse the checks</a>
	</p>
</article>
