<script lang="ts">
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
		'Deploylint is a launch-readiness scanner for AI-built apps, checking SEO blockers, security exposure, social previews, legal gaps, and CI gates before public release.';
	const canonical = `${base}/about`;
	const jsonLd = [
		...buildDeploylintJsonLd({ base, description, price: '0.00' }),
		buildPageJsonLd({ base, canonical, title, description, type: 'AboutPage' })
	];
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<article class="mx-auto max-w-3xl px-4 py-12 text-zinc-300">
	<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
		Launch readiness, not another audit score
	</p>
	<h1 class="mb-4 text-3xl font-bold text-white sm:text-4xl">About Deploylint</h1>
	<p class="mb-8 text-lg leading-8 text-zinc-400">
		Deploylint checks whether an AI-built app is ready to be shared publicly. It scans the
		production URL and public repo surface for launch blockers that ordinary SEO checkers,
		Lighthouse runs, and social preview debuggers often miss.
	</p>

	<section class="mb-10">
		<h2 class="mb-3 text-xl font-semibold text-white">What Deploylint is for</h2>
		<p class="leading-7 text-zinc-400">
			The product is built for founders and developers shipping fast with tools like Cursor, Bolt,
			Lovable, and similar coding agents. The report answers one practical question: should this URL
			be posted today, or is there a launch blocker that needs fixing first?
		</p>
	</section>

	<section class="mb-10">
		<h2 class="mb-3 text-xl font-semibold text-white">What it checks</h2>
		<ul class="list-disc space-y-2 pl-6 leading-7 text-zinc-400">
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
			Deploylint does not try to replace Lighthouse or enterprise security scanners. It turns the
			public launch surface into a short GO, CONDITIONAL, or NO-GO verdict with fix prompts and
			re-scan proof, so small teams can repair the issues that matter before a public release.
		</p>
	</section>

	<p>
		<a class="text-sky-400 hover:underline" href="/">Run a free scan</a>
		<span class="mx-2 text-zinc-600">&middot;</span>
		<a class="text-sky-400 hover:underline" href="/checks">Browse the checks</a>
	</p>
</article>
