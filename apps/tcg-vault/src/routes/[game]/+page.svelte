<script lang="ts">
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.game.name} — sets & prices | TCG Vault</title>
	<meta
		name="description"
		content="Browse {data.game.name} sets, card prices, and checklists on TCG Vault."
	/>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-10">
	<Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: data.game.name }]} />

	<h1 class="mb-2 text-3xl font-bold text-white">{data.game.name}</h1>
	<p class="mb-8 text-zinc-400">{data.game.tagline}</p>

	{#if data.sets.length === 0}
		<div class="rounded-xl border border-dashed border-zinc-700 p-10 text-center text-zinc-500">
			No sets synced yet for this game.
		</div>
	{:else}
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.sets as set (set.id)}
				<li>
					<a
						href="/{data.game.slug}/{set.slug}"
						class="block rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-4 hover:border-zinc-600"
					>
						<span class="font-medium text-white">{set.name}</span>
						<span class="mt-1 block text-sm text-zinc-500">
							{set.card_count} cards
							{#if set.code}
								· {set.code.toUpperCase()}
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
