<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = 'https://deploylint.com';
	const title = buildSeoTitle('Deploylint Changelog - Product updates and release notes');
	const description =
		'Deploylint release notes for launch-readiness checks, CI gates, MCP tools, payment unlocks, and product changes.';
	const canonical = `${base}/changelog`;
	const jsonLd = [buildPageJsonLd({ base, canonical, title, description })];
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-3xl px-4 py-12">
	<h1 class="mb-2 text-3xl font-bold text-white">Changelog</h1>
	<p class="mb-8 text-sm text-zinc-500">
		User-facing changes to <a class="text-sky-400 hover:underline" href="/">Deploylint</a>. Format
		follows
		<a class="text-sky-400 hover:underline" href="https://keepachangelog.com/en/1.1.0/"
			>Keep a Changelog</a
		>.
	</p>

	<article class="prose-invert text-sm leading-relaxed">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- escaped in renderChangelogHtml() -->
		{@html data.html}
	</article>
</div>
