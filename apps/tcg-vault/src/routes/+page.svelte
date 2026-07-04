<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>TCG Vault — One stop for every trading card game</title>
	<meta
		name="description"
		content="Live card prices, set checklists, and collection tracking for Magic, Pokémon, Yu-Gi-Oh!, Lorcana, One Piece, and more."
	/>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-12">
	<section class="mb-14 text-center">
		<p class="mb-3 text-sm font-medium tracking-[0.2em] text-amber-400/90 uppercase">
			One stop shop
		</p>
		<h1 class="mb-4 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
			Every TCG. One vault.
		</h1>
		<p class="mx-auto max-w-2xl text-lg text-zinc-400">
			Prices, set checklists, and portfolio tracking — built for collectors who are tired of jumping
			between a dozen niche price sites.
		</p>
		{#if data.catalog.cards > 0}
			<p class="mt-6 text-sm text-zinc-500">
				{data.catalog.cards.toLocaleString()} cards · {data.catalog.sets.toLocaleString()} sets indexed
			</p>
		{:else}
			<p class="mt-6 text-sm text-amber-400/80">
				Catalog empty — run D1 migration + Scryfall sync (see README)
			</p>
		{/if}
	</section>

	<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each data.games as game (game.slug)}
			<a
				href="/{game.slug}"
				class="vault-card group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 hover:bg-zinc-900"
			>
				<div
					class="pointer-events-none absolute inset-0 bg-linear-to-br opacity-60 {game.accent}"
				></div>
				<div class="relative">
					<div class="mb-2 flex items-center justify-between gap-2">
						<h2 class="font-semibold text-white">{game.name}</h2>
						<span
							class="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase
              {game.status === 'live'
								? 'bg-emerald-500/20 text-emerald-300'
								: game.status === 'syncing'
									? 'bg-amber-500/20 text-amber-300'
									: 'bg-zinc-700/50 text-zinc-400'}"
						>
							{game.status}
						</span>
					</div>
					<p class="text-sm text-zinc-400">{game.tagline}</p>
				</div>
			</a>
		{/each}
	</section>

	<section class="mt-16 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
		<h2 class="mb-2 text-xl font-semibold text-white">Pro collection tracking</h2>
		<p class="mb-4 text-zinc-400">
			Free: browse all prices and track up to 50 cards. Pro ($7/mo): unlimited collection, price
			alerts, set completion %, CSV export.
		</p>
		<span class="inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300"
			>Stripe — coming soon</span
		>
	</section>
</div>
