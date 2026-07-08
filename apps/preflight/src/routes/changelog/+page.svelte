<script lang="ts">
	import { resolve } from '$app/paths';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = 'https://deploylint.com';
	const title = buildSeoTitle('Deploylint Changelog - Product updates and release notes');
	const description =
		'Deploylint release notes for CI hardening, deploy gates, repo checks, MCP tools, payment unlocks, and product changes.';
	const canonical = `${base}/changelog`;
	const jsonLd = [buildPageJsonLd({ base, canonical, title, description })];
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-3xl px-4 py-12">
	<h1 class="mb-2 text-3xl font-bold text-white">Changelog</h1>
	<p class="mb-8 text-sm text-zinc-500">
		User-facing changes to <a
			class="text-sky-300 underline underline-offset-4 hover:text-sky-200"
			href={resolve('/')}>Deploylint</a
		>. Format follows
		<a
			class="text-sky-300 underline underline-offset-4 hover:text-sky-200"
			href="https://keepachangelog.com/en/1.1.0/">Keep a Changelog</a
		>.
	</p>

	<article class="prose-invert text-sm leading-relaxed">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped in renderChangelogHtml() -->
		{@html data.html}
	</article>
</div>
