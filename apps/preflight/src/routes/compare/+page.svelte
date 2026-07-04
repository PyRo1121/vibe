<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));

	type Cell = 'yes' | 'partial' | 'no';

	const rows: Array<{
		feature: string;
		deploylint: Cell;
		lighthouse: Cell;
		ogTools: Cell;
		generic: Cell;
		note?: string;
	}> = [
		{
			feature: 'GO / NO-GO launch verdict',
			deploylint: 'yes',
			lighthouse: 'no',
			ogTools: 'no',
			generic: 'partial',
			note: 'Deploylint answers “safe to post today?” — not “how fast is it?”'
		},
		{
			feature: 'Embarrassment radar (public failure mode)',
			deploylint: 'yes',
			lighthouse: 'no',
			ogTools: 'no',
			generic: 'partial'
		},
		{
			feature: 'og:image content-type validation',
			deploylint: 'yes',
			lighthouse: 'no',
			ogTools: 'partial',
			generic: 'no',
			note: 'Catches SPA routes returning HTML instead of a real image'
		},
		{
			feature: 'Secrets in live JS bundles',
			deploylint: 'yes',
			lighthouse: 'no',
			ogTools: 'no',
			generic: 'partial'
		},
		{
			feature: 'GitHub repo scan (.env, licenses, OSV vulns)',
			deploylint: 'yes',
			lighthouse: 'no',
			ogTools: 'no',
			generic: 'no'
		},
		{
			feature: 'Exposed .env / .git path probes',
			deploylint: 'yes',
			lighthouse: 'no',
			ogTools: 'no',
			generic: 'partial',
			note: 'Read-only same-origin checks — catches Preflyt-class deployment mistakes'
		},
		{
			feature: 'Health endpoint + web manifest',
			deploylint: 'yes',
			lighthouse: 'no',
			ogTools: 'no',
			generic: 'partial'
		},
		{
			feature: 'Cursor fix prompts + re-scan proof',
			deploylint: 'yes',
			lighthouse: 'no',
			ogTools: 'no',
			generic: 'no'
		},
		{
			feature: 'CI deploy gate (block merges on blockers)',
			deploylint: 'yes',
			lighthouse: 'partial',
			ogTools: 'no',
			generic: 'no'
		},
		{
			feature: 'Core Web Vitals / performance lab',
			deploylint: 'partial',
			lighthouse: 'yes',
			ogTools: 'no',
			generic: 'partial',
			note: 'Deploylint links PageSpeed on demand — we do not clone Lighthouse'
		},
		{
			feature: 'Deep accessibility audit (contrast, ARIA tree)',
			deploylint: 'partial',
			lighthouse: 'yes',
			ogTools: 'no',
			generic: 'partial'
		},
		{
			feature: 'OG tag preview only',
			deploylint: 'partial',
			lighthouse: 'no',
			ogTools: 'yes',
			generic: 'partial'
		}
	];

	const cellLabel: Record<Cell, string> = {
		yes: 'Yes',
		partial: 'Partial',
		no: 'No'
	};

	const cellClass: Record<Cell, string> = {
		yes: 'text-emerald-400',
		partial: 'text-amber-400',
		no: 'text-zinc-500'
	};
</script>

<svelte:head>
	<title>Compare — Deploylint vs Lighthouse & OG checkers</title>
	<meta
		name="description"
		content="Honest comparison: Deploylint is launch judgment and embarrassment prevention, not a Lighthouse clone or OG debugger."
	/>
	<link rel="canonical" href="{base}/compare" />
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-12 text-zinc-300">
	<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
		Not another audit score
	</p>
	<h1 class="mb-4 text-3xl font-bold text-white sm:text-4xl">How Deploylint compares</h1>
	<p class="mb-8 max-w-3xl text-lg text-zinc-400">
		<strong class="font-medium text-zinc-200">90+ checks</strong> aimed at one question: should you post
		this URL publicly today? Lighthouse, OG debuggers, and generic scanners answer different questions
		— we are honest about where each tool wins.
	</p>

	<div class="overflow-x-auto rounded-2xl border border-zinc-800">
		<table class="w-full min-w-[720px] border-collapse text-left text-sm">
			<caption class="sr-only">
				Feature comparison between Deploylint, Lighthouse, OG preview tools, and generic launch
				checkers
			</caption>
			<thead>
				<tr class="border-b border-zinc-800 bg-zinc-900/60">
					<th scope="col" class="px-4 py-3 font-semibold text-white">What you need</th>
					<th scope="col" class="px-4 py-3 font-semibold text-sky-300">Deploylint</th>
					<th scope="col" class="px-4 py-3 font-semibold text-zinc-400">Lighthouse</th>
					<th scope="col" class="px-4 py-3 font-semibold text-zinc-400">OG debuggers</th>
					<th scope="col" class="px-4 py-3 font-semibold text-zinc-400">Generic scanners</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.feature)}
					<tr class="border-b border-zinc-800/80 align-top">
						<th scope="row" class="px-4 py-3 font-medium text-zinc-200">
							{row.feature}
							{#if row.note}
								<p class="mt-1 text-xs font-normal text-zinc-500">{row.note}</p>
							{/if}
						</th>
						<td class="px-4 py-3 {cellClass[row.deploylint]}">{cellLabel[row.deploylint]}</td>
						<td class="px-4 py-3 {cellClass[row.lighthouse]}">{cellLabel[row.lighthouse]}</td>
						<td class="px-4 py-3 {cellClass[row.ogTools]}">{cellLabel[row.ogTools]}</td>
						<td class="px-4 py-3 {cellClass[row.generic]}">{cellLabel[row.generic]}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<section class="mt-10 rounded-2xl border border-sky-900/40 bg-sky-950/20 p-6">
		<h2 class="text-lg font-semibold text-white">When to use what</h2>
		<ul class="mt-3 list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				<strong class="text-zinc-300">Deploylint</strong> — night before Product Hunt, Reddit, or X: embarrassment
				radar, legal/social blockers, fix prompts, re-scan proof.
			</li>
			<li>
				<strong class="text-zinc-300">Lighthouse</strong> — performance budgets, accessibility lab audits,
				SEO technical scorecards.
			</li>
			<li>
				<strong class="text-zinc-300">OG debuggers</strong> — quick card preview after you already fixed
				meta tags.
			</li>
		</ul>
	</section>

	<p class="mt-8">
		<a class="text-sky-400 hover:underline" href="/">← Run a free scan</a>
		<span class="mx-2 text-zinc-600">·</span>
		<a class="text-sky-400 hover:underline" href="/developers">CI gate setup</a>
	</p>
</div>
