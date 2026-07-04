<script lang="ts">
	interface Crumb {
		label: string;
		href?: string;
	}

	let { items }: { items: Crumb[] } = $props();
</script>

<nav aria-label="Breadcrumb" class="mb-6 text-sm text-zinc-500">
	{#each items as item, index (index)}
		{#if index > 0}
			<span class="mx-2">/</span>
		{/if}
		{#if item.href}
			<a href={item.href} class="hover:text-zinc-300">{item.label}</a>
		{:else}
			<span class="text-zinc-300" aria-current="page">{item.label}</span>
		{/if}
	{/each}
</nav>
