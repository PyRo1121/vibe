<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const guide = $derived(data.guide);
	const title = $derived(buildSeoTitle(guide.title));
	const description = $derived(guide.description);
	const canonical = $derived(`${base}/guides/${guide.slug}`);
	const jsonLd = $derived([
		{
			...buildPageJsonLd({ base, canonical, title, description, type: 'Article' }),
			headline: title,
			mainEntityOfPage: canonical,
			about: guide.eyebrow
		},
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: guide.faq.map((item) => ({
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

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<article class="mx-auto max-w-3xl px-4 py-12 text-zinc-300">
	<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">{guide.eyebrow}</p>
	<h1 class="mb-4 text-3xl font-bold text-white sm:text-4xl">{guide.h1}</h1>
	<p class="mb-8 text-lg leading-8 text-zinc-400">{guide.intro}</p>

	<div class="mb-10 rounded-2xl border border-sky-900/40 bg-sky-950/20 p-6">
		<h2 class="mb-3 text-lg font-semibold text-white">Quick checklist</h2>
		<ul class="space-y-2 text-sm text-zinc-300">
			{#each guide.checklist as item (item)}
				<li class="flex gap-3">
					<span class="mt-1 text-sky-400">+</span>
					<span>{item}</span>
				</li>
			{/each}
		</ul>
	</div>

	<div class="space-y-10">
		{#each guide.sections as section (section.heading)}
			<section>
				<h2 class="mb-3 text-2xl font-semibold text-white">{section.heading}</h2>
				<p class="leading-7 text-zinc-400">{section.body}</p>
				<ul class="mt-4 list-disc space-y-2 pl-6 text-sm leading-6 text-zinc-400">
					{#each section.bullets as bullet (bullet)}
						<li>{bullet}</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>

	<section class="mt-12">
		<h2 class="mb-4 text-2xl font-semibold text-white">Questions</h2>
		<div class="space-y-4">
			{#each guide.faq as item (item.question)}
				<div class="rounded-xl border border-zinc-800 p-4">
					<h3 class="font-medium text-white">{item.question}</h3>
					<p class="mt-2 text-sm leading-6 text-zinc-400">{item.answer}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
		<h2 class="text-lg font-semibold text-white">Run the check</h2>
		<p class="mt-2 text-sm leading-6 text-zinc-400">
			Paste your live URL into Deploylint, fix the P0 issues first, then re-scan before you share
			the product publicly.
		</p>
		<p class="mt-4">
			<a class="text-sky-400 hover:underline" href="/">Run a free scan</a>
			<span class="mx-2 text-zinc-600">/</span>
			<a class="text-sky-400 hover:underline" href="/checks">Browse all checks</a>
		</p>
	</section>
</article>
