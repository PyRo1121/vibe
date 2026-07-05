<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Changelog — Deploylint</title>
	<meta name="description" content="Deploylint release notes and notable product changes." />
</svelte:head>

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
