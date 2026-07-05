<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const title = 'Deploylint vs ShipReady, WebsiteReady, PageLens, and Lighthouse';
	const description =
		'Compare Deploylint with ShipReady, WebsiteReady, PageLens, and Lighthouse for launch readiness, embarrassment prevention, CI gating, and agent-ready fixes.';
	const canonical = $derived(`${base}/compare`);
	const jsonLd = $derived([
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: title,
			url: canonical,
			description,
			isPartOf: {
				'@type': 'WebSite',
				name: 'Deploylint',
				url: base
			}
		}
	]);

	type Cell = 'yes' | 'partial' | 'no';

	const rows: Array<{
		feature: string;
		deploylint: Cell;
		shipReady: Cell;
		websiteReady: Cell;
		pageLens: Cell;
		note?: string;
	}> = [
		{
			feature: 'GO / NO-GO launch verdict',
			deploylint: 'yes',
			shipReady: 'partial',
			websiteReady: 'partial',
			pageLens: 'no',
			note: 'Deploylint answers “safe to post today?” — not “how fast is it?”'
		},
		{
			feature: 'Embarrassment brief (public failure modes)',
			deploylint: 'yes',
			shipReady: 'no',
			websiteReady: 'no',
			pageLens: 'no'
		},
		{
			feature: 'Re-scan score proof (before/after delta)',
			deploylint: 'yes',
			shipReady: 'partial',
			websiteReady: 'partial',
			pageLens: 'yes'
		},
		{
			feature: 'Cursor fix prompts + master paste',
			deploylint: 'yes',
			shipReady: 'no',
			websiteReady: 'no',
			pageLens: 'no'
		},
		{
			feature: 'SPF / DMARC / DKIM email auth probes',
			deploylint: 'yes',
			shipReady: 'partial',
			websiteReady: 'no',
			pageLens: 'no',
			note: 'DKIM selector DNS check when SPF is present'
		},
		{
			feature: 'Exposed .env / .git path probes',
			deploylint: 'yes',
			shipReady: 'partial',
			websiteReady: 'no',
			pageLens: 'no',
			note: 'Read-only same-origin checks — catches deployment mistakes before launch day'
		},
		{
			feature: 'Secrets in live JS bundles',
			deploylint: 'yes',
			shipReady: 'partial',
			websiteReady: 'no',
			pageLens: 'no'
		},
		{
			feature: 'CI deploy gate + MCP for agents',
			deploylint: 'yes',
			shipReady: 'no',
			websiteReady: 'no',
			pageLens: 'no'
		},
		{
			feature: 'GitHub repo scan (licenses, OSV vulns)',
			deploylint: 'yes',
			shipReady: 'no',
			websiteReady: 'no',
			pageLens: 'no'
		},
		{
			feature: 'security.txt (RFC 9116 disclosure)',
			deploylint: 'yes',
			shipReady: 'partial',
			websiteReady: 'no',
			pageLens: 'no'
		},
		{
			feature: 'Shareable report permalink + README badge',
			deploylint: 'yes',
			shipReady: 'partial',
			websiteReady: 'partial',
			pageLens: 'yes',
			note: 'OG badge on /r/[id] — prove score without screenshots'
		},
		{
			feature: 'Visual screenshots / page capture',
			deploylint: 'no',
			shipReady: 'partial',
			websiteReady: 'no',
			pageLens: 'yes',
			note: 'Deploylint is honest: we do not ship screenshots yet — depth is in checks, not pixels'
		},
		{
			feature: 'og:image content-type validation',
			deploylint: 'yes',
			shipReady: 'partial',
			websiteReady: 'partial',
			pageLens: 'partial',
			note: 'Catches SPA routes returning HTML instead of a real image'
		},
		{
			feature: 'Core Web Vitals / Lighthouse-style perf lab',
			deploylint: 'partial',
			shipReady: 'partial',
			websiteReady: 'yes',
			pageLens: 'no',
			note: 'Deploylint links PageSpeed on demand — we do not clone Lighthouse'
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

<SeoHead {title} {description} {canonical} image={`${base}/og.png`} {jsonLd} />

<div class="mx-auto max-w-5xl px-4 py-12 text-zinc-300">
	<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
		Not another audit score
	</p>
	<h1 class="mb-4 text-3xl font-bold text-white sm:text-4xl">How Deploylint compares</h1>
	<p class="mb-8 max-w-3xl text-lg text-zinc-400">
		<strong class="font-medium text-zinc-200">90+ checks</strong> aimed at one question: should you post
		this URL publicly today? We name real alternatives and mark partial honestly — including where we
		do not have screenshots yet.
	</p>

	<div class="overflow-x-auto rounded-2xl border border-zinc-800">
		<table class="w-full min-w-[800px] border-collapse text-left text-sm">
			<caption class="sr-only">
				Feature comparison between Deploylint, ShipReady, WebsiteReady, and PageLens
			</caption>
			<thead>
				<tr class="border-b border-zinc-800 bg-zinc-900/60">
					<th scope="col" class="px-4 py-3 font-semibold text-white">What you need</th>
					<th scope="col" class="px-4 py-3 font-semibold text-sky-300">Deploylint</th>
					<th scope="col" class="px-4 py-3 font-semibold text-zinc-400">ShipReady</th>
					<th scope="col" class="px-4 py-3 font-semibold text-zinc-400">WebsiteReady</th>
					<th scope="col" class="px-4 py-3 font-semibold text-zinc-400">PageLens</th>
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
						<td class="px-4 py-3 {cellClass[row.shipReady]}">{cellLabel[row.shipReady]}</td>
						<td class="px-4 py-3 {cellClass[row.websiteReady]}">{cellLabel[row.websiteReady]}</td>
						<td class="px-4 py-3 {cellClass[row.pageLens]}">{cellLabel[row.pageLens]}</td>
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
				<strong class="text-zinc-300">ShipReady / WebsiteReady</strong> — broader site health or checklist-style
				audits; weaker on agent-native fix loops and deployment probes.
			</li>
			<li>
				<strong class="text-zinc-300">PageLens</strong> — visual page review and shareable captures; different
				question than launch blockers.
			</li>
			<li>
				<strong class="text-zinc-300">Lighthouse</strong> (not in table) — performance budgets and deep
				accessibility lab audits; use alongside Deploylint, not instead of it.
			</li>
		</ul>
	</section>

	<p class="mt-8">
		<a class="text-sky-400 hover:underline" href="/">← Run a free scan</a>
		<span class="mx-2 text-zinc-600">·</span>
		<a class="text-sky-400 hover:underline" href="/developers">CI gate setup</a>
	</p>
</div>
