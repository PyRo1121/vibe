<script lang="ts">
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import { formatUsd } from '$lib/format';

	let { data } = $props();

	const card = $derived(data.card);
	const imageUrl = $derived(card.image_source_url);
</script>

<svelte:head>
	<title>{card.name} price — {card.set_name} | TCG Vault</title>
	<meta
		name="description"
		content="{card.name} from {card.set_name}. Market price {formatUsd(card.market_usd)}."
	/>
	{#if imageUrl}
		<meta property="og:image" content={imageUrl} />
	{/if}
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-10">
	<Breadcrumbs
		items={[
			{ label: 'Home', href: '/' },
			{ label: data.game.name, href: `/${data.game.slug}` },
			{ label: card.set_name ?? 'Set', href: `/${data.game.slug}/${card.set_slug}` },
			{ label: card.name }
		]}
	/>

	<div class="grid gap-10 lg:grid-cols-[280px_1fr]">
		<div class="mx-auto w-full max-w-[280px]">
			{#if imageUrl}
				<img
					src={imageUrl}
					alt={card.name}
					class="w-full rounded-xl border border-zinc-800 shadow-lg"
					loading="eager"
				/>
			{:else}
				<div
					class="flex aspect-[5/7] items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-900 text-zinc-600"
				>
					No image
				</div>
			{/if}
		</div>

		<div>
			<h1 class="text-3xl font-bold text-white">{card.name}</h1>
			<p class="mt-1 text-zinc-400">
				{card.set_name}
				{#if card.collector_number}
					· #{card.collector_number}
				{/if}
				{#if card.rarity}
					· <span class="capitalize">{card.rarity}</span>
				{/if}
			</p>

			<div class="mt-8 grid gap-4 sm:grid-cols-2">
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
					<p class="text-xs tracking-wide text-zinc-500 uppercase">Market (USD)</p>
					<p class="mt-1 text-3xl font-bold text-amber-400">{formatUsd(card.market_usd)}</p>
					{#if card.market_usd_foil}
						<p class="mt-2 text-sm text-zinc-400">Foil: {formatUsd(card.market_usd_foil)}</p>
					{/if}
				</div>
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5">
					<p class="text-xs tracking-wide text-zinc-500 uppercase">Market (EUR)</p>
					<p class="mt-1 text-2xl font-semibold text-zinc-200">
						{card.market_eur != null ? `€${card.market_eur.toFixed(2)}` : '—'}
					</p>
					{#if card.price_updated_at}
						<p class="mt-2 text-xs text-zinc-600">
							Updated {new Date(card.price_updated_at).toLocaleDateString()}
							· {card.price_source}
						</p>
					{/if}
				</div>
			</div>

			<p class="mt-6 text-xs text-zinc-600">
				Market prices are listing aggregates, not guaranteed sale prices. Data from {card.price_source ??
					'partners'}.
			</p>

			<button
				type="button"
				disabled
				class="mt-8 rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-400"
			>
				Add to collection (Pro — soon)
			</button>
		</div>
	</div>
</div>
