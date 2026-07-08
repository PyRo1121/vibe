<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { catalogEntries } from '$lib/scan/catalog';
	import { buildCatalogGroups, catalogTitle } from '$lib/scan/catalog-view';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const canonical = $derived(`${base}/checks`);
	const entries = catalogEntries();
	const groups = buildCatalogGroups(entries);
	const total = entries.length;
	const title = buildSeoTitle('Deploylint check catalog');
	const description =
		'Browse Deploylint CI, repo, deploy target, security, and readiness-control checks.';
	const jsonLd = $derived([
		buildPageJsonLd({ base, canonical, title, description, type: 'CollectionPage' })
	]);
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-5xl px-4 py-12">
	<section class="mb-8">
		<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">Check catalog</p>
		<h1 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
			What Deploylint checks, and why
		</h1>
		<p class="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
			This compact readiness-control catalog shows the signals Deploylint keeps visible in reports.
			It currently tracks {total} high-signal checks across workflow risk, deploy blockers, security headers,
			exposed deployment surfaces, CVEs, service readiness, SEO, social previews, AI discoverability,
			and app polish.
		</p>
	</section>

	<div class="space-y-8">
		{#each groups as group (group.priority)}
			<section>
				<div class="mb-3 flex flex-wrap items-baseline gap-3">
					<span
						class="rounded bg-zinc-800 px-2 py-1 text-xs font-bold tracking-wide text-zinc-300 uppercase"
					>
						{group.priority}
					</span>
					<h2 class="text-xl font-semibold text-white">{group.label}</h2>
					<p class="text-sm text-zinc-500">{group.description}</p>
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each group.entries as entry (entry.id)}
						<article class="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
							<div class="flex flex-wrap items-start justify-between gap-2">
								<h3 class="max-w-[18rem] font-medium text-white">{catalogTitle(entry.id)}</h3>
								<code class="rounded bg-zinc-950 px-2 py-0.5 text-xs text-zinc-500">
									{entry.id}
								</code>
							</div>
							<p class="mt-3 text-sm leading-6 text-zinc-400">{entry.why}</p>
						</article>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>
