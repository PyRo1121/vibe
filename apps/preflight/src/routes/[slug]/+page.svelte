<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const page = $derived(data.page);
	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const canonical = $derived(`${base}/${page.slug}`);
	const title = $derived(page.title);
	const description = $derived(page.description);
	const jsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: page.title,
			url: canonical,
			description: page.description,
			isPartOf: {
				'@type': 'WebSite',
				name: 'Deploylint',
				url: base
			}
		},
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: page.faq.map((item) => ({
				'@type': 'Question',
				name: item.question,
				acceptedAnswer: {
					'@type': 'Answer',
					text: item.answer
				}
			}))
		}
	]);
</script>

<SeoHead {title} {description} {canonical} image={`${base}/og.png`} {jsonLd} />

<div class="mx-auto max-w-5xl px-4 py-12 text-zinc-300">
	<section class="pb-10">
		<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">{page.kicker}</p>
		<h1 class="max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
			{page.h1}
		</h1>
		<p class="mt-5 max-w-3xl text-base leading-8 text-zinc-400 sm:text-lg">
			{page.description}
		</p>
		<p class="mt-4 max-w-3xl text-sm leading-7 text-zinc-500">{page.searchIntent}</p>
		<div class="mt-8 flex flex-wrap items-center gap-4">
			<a
				href="/"
				class="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-500"
			>
				{page.primaryCta}
			</a>
			<a href="/checks" class="text-sm font-medium text-sky-300 hover:underline">
				Browse the check catalog
			</a>
		</div>
	</section>

	<section class="grid gap-4 md:grid-cols-3" aria-label="What Deploylint checks">
		{#each page.sections as section (section.heading)}
			<article class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
				<h2 class="text-lg font-semibold text-white">{section.heading}</h2>
				<p class="mt-3 text-sm leading-7 text-zinc-400">{section.body}</p>
			</article>
		{/each}
	</section>

	<section class="mt-12">
		<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
			<div>
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">FAQ</p>
				<h2 class="mt-2 text-2xl font-bold text-white">Common launch questions</h2>
			</div>
			<a href="/compare" class="text-sm font-medium text-sky-300 hover:underline">
				Compare Deploylint
			</a>
		</div>
		<div class="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/30">
			{#each page.faq as item (item.question)}
				<article class="p-5">
					<h3 class="font-semibold text-white">{item.question}</h3>
					<p class="mt-2 text-sm leading-7 text-zinc-400">{item.answer}</p>
				</article>
			{/each}
		</div>
	</section>
</div>
