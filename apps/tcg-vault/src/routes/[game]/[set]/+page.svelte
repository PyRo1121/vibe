<script lang="ts">
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import { formatUsd } from '$lib/format';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.set.name} checklist & prices | TCG Vault</title>
	<meta
		name="description"
		content="{data.set.name} card list with market prices. Set value {formatUsd(data.totalValue)}."
	/>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-10">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: '/' },
			{ label: data.game.name, href: `/${data.game.slug}` },
			{ label: data.set.name }
		]}
	/>

	<div class="mb-8 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold text-white">{data.set.name}</h1>
			<p class="mt-1 text-zinc-400">{data.cards.length} cards · checklist & prices</p>
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-right">
			<p class="text-xs tracking-wide text-zinc-500 uppercase">Set market total</p>
			<p class="text-xl font-semibold text-amber-400">{formatUsd(data.totalValue)}</p>
		</div>
	</div>

	<div class="overflow-x-auto rounded-xl border border-zinc-800">
		<table class="min-w-full text-left text-sm">
			<thead class="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
				<tr>
					<th scope="col" class="px-4 py-3 font-medium">#</th>
					<th scope="col" class="px-4 py-3 font-medium">Card</th>
					<th scope="col" class="px-4 py-3 font-medium">Rarity</th>
					<th scope="col" class="px-4 py-3 text-right font-medium">Market</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-zinc-800/80">
				{#each data.cards as card (card.id)}
					<tr class="transition-colors hover:bg-zinc-900/60">
						<td class="px-4 py-3 text-zinc-500">{card.collector_number ?? '—'}</td>
						<td class="px-4 py-3">
							<a
								href="/{data.game.slug}/{data.set.slug}/{card.slug}"
								class="font-medium text-white hover:text-amber-400"
							>
								{card.name}
							</a>
						</td>
						<td class="px-4 py-3 text-zinc-500 capitalize">{card.rarity ?? '—'}</td>
						<td class="px-4 py-3 text-right text-zinc-200">{formatUsd(card.market_usd)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
