<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';

	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { data, children } = $props();

	const brandParts = $derived(data.siteName.split(' '));
	const brandLead = $derived(brandParts.slice(0, -1).join(' ') || data.siteName);
	const brandAccent = $derived(brandParts.length > 1 ? brandParts.at(-1) : '');

	const nav = [
		{ href: '/mtg', label: 'MTG' },
		{ href: '/pokemon', label: 'Pokémon' },
		{ href: '/yugioh', label: 'Yu-Gi-Oh!' }
	] as const;

	function navActive(href: string) {
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-amber-400 focus:px-4 focus:py-2 focus:font-medium focus:text-zinc-950"
>
	Skip to content
</a>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<header
		class="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/60"
	>
		<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
			<a
				href="/"
				class="text-lg font-bold tracking-tight text-white transition-opacity hover:opacity-90"
			>
				{#if brandAccent}
					{brandLead}
					<span class="text-amber-400">{brandAccent}</span>
				{:else}
					{data.siteName}
				{/if}
			</a>
			<nav aria-label="Main navigation" class="flex gap-1 text-sm">
				{#each nav as item (item.href)}
					<a
						href={item.href}
						class="rounded-lg px-3 py-1.5 transition-colors {navActive(item.href)
							? 'bg-zinc-800 text-white'
							: 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}"
						aria-current={navActive(item.href) ? 'page' : undefined}
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</div>
	</header>
	<main id="main" class="vault-mesh min-h-[calc(100vh-8rem)]">{@render children()}</main>
	<footer class="border-t border-zinc-800 py-8 text-center text-xs text-zinc-600">
		Market prices from Scryfall, YGOProDeck, and partners. Not affiliated with Wizards, Konami, or
		The Pokémon Company.
	</footer>
</div>

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	@keyframes fade-out {
		to {
			opacity: 0;
		}
	}

	:global(::view-transition-old(root)) {
		animation: 150ms ease-out both fade-out;
	}

	:global(::view-transition-new(root)) {
		animation: 200ms ease-in both fade-in;
	}
</style>
