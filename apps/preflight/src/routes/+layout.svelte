<script lang="ts">
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { watchPlausible, plausibleInitSnippet } from '$lib/client/plausible';
	import { ALPHA_FREE_UNLOCK } from '$lib/product/alpha';
	import './layout.css';

	let {
		children,
		data
	}: {
		children: import('svelte').Snippet;
		data: {
			plausibleDomain?: string | null;
			plausibleProxy?: { script: string; endpoint: string } | null;
		};
	} = $props();

	onMount(() => {
		if (data.plausibleDomain) watchPlausible();
	});

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

<svelte:head>
	{#if data.plausibleDomain && data.plausibleProxy}
		<meta name="plausible-domain" content={data.plausibleDomain} />
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- init stub built server-side -->
		{@html plausibleInitSnippet(data.plausibleDomain, data.plausibleProxy.endpoint)}
		<script defer src={data.plausibleProxy.script}></script>
	{/if}
</svelte:head>

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-sky-400 focus:px-4 focus:py-2 focus:font-medium focus:text-zinc-950"
>
	Skip to content
</a>

<div class="min-h-screen">
	<header
		class="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-950/60 print:hidden"
	>
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
			<a href="/" class="flex flex-col leading-none transition-opacity hover:opacity-90">
				<span class="text-lg font-semibold tracking-tight text-white">Deploylint</span>
				{#if ALPHA_FREE_UNLOCK}
					<span class="mt-0.5 text-[9px] font-semibold tracking-[0.24em] text-sky-400 uppercase">
						Alpha
					</span>
				{/if}
			</a>
			<nav aria-label="Main navigation" class="flex items-center gap-4 text-xs text-zinc-500">
				<a href="/compare" class="hover:text-zinc-300">Compare</a>
				<a href="/developers" class="hover:text-zinc-300">CI gate</a>
				<span class="hidden sm:inline">90+ launch checks · fix & re-scan</span>
			</nav>
		</div>
	</header>
	<main id="main" class="preflight-mesh min-h-[calc(100vh-8rem)]">{@render children()}</main>
	<footer class="border-t border-zinc-800 py-8 text-center text-xs text-zinc-600 print:hidden">
		<p class="mb-2">Built for builders who ship fast and hate public surprises.</p>
		<p>
			<a href="/developers" class="hover:text-zinc-400">Developers</a>
			<span class="mx-2">·</span>
			<a href="/changelog" class="hover:text-zinc-400">Changelog</a>
			<span class="mx-2">·</span>
			<a href="/privacy" class="hover:text-zinc-400">Privacy</a>
			<span class="mx-2">·</span>
			<a href="/terms" class="hover:text-zinc-400">Terms</a>
		</p>
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
