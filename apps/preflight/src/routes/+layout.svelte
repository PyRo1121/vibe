<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { watchPlausible, plausibleInitSnippet } from '$lib/client/plausible';
	import { onMount } from 'svelte';

	import './layout.css';

	let {
		children,
		data
	}: {
		children: import('svelte').Snippet;
		data: {
			alphaFreeUnlock: boolean;
			plausibleDomain?: string | null;
			plausibleScript?: string | null;
		};
	} = $props();

	onMount(() => {
		if (data.plausibleScript) watchPlausible();
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
	{#if data.plausibleDomain && data.plausibleScript}
		<meta name="plausible-domain" content={data.plausibleDomain} />
		<script async src={data.plausibleScript}></script>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- init stub built server-side -->
		{@html plausibleInitSnippet()}
	{/if}
</svelte:head>

<a
	href="#main"
	class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-sky-400 focus:px-4 focus:py-2 focus:font-medium focus:text-zinc-950"
>
	Skip to content
</a>

<div class="min-h-screen">
	<header class="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950 print:hidden">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
			<a href="/" class="flex flex-col leading-none transition-opacity hover:opacity-90">
				<span class="text-lg font-semibold tracking-tight text-white">Deploylint</span>
				{#if data.alphaFreeUnlock}
					<span class="mt-0.5 text-[9px] font-semibold tracking-[0.24em] text-sky-400 uppercase">
						Alpha
					</span>
				{/if}
			</a>
			<nav aria-label="Main navigation" class="flex items-center gap-4 text-xs text-zinc-300">
				<a href="/tools" class="hover:text-white">Tools</a>
				<a href="/compare" class="hover:text-white">Compare</a>
				<a href="/checks" class="hover:text-white">Checks</a>
				<a href="/guides/website-launch-checklist" class="hover:text-white">Guides</a>
				<a href="/developers" class="hover:text-white">CI gate</a>
				<span class="hidden text-zinc-400 sm:inline">CI hardening &middot; deploy gates</span>
			</nav>
		</div>
	</header>
	<main id="main" class="min-h-[calc(100vh-8rem)]">{@render children()}</main>
	<footer class="border-t border-zinc-800 py-8 text-center text-xs text-zinc-400 print:hidden">
		<p class="mb-2">Built for builders hardening the path from pull request to production.</p>
		<p>
			<a href="/tools" class="hover:text-white">Tools</a>
			<span class="mx-2">&middot;</span>
			<a href="/tools/github-actions-security-checker" class="hover:text-white">GitHub Actions</a>
			<span class="mx-2">&middot;</span>
			<a href="/" class="hover:text-white">Scanner</a>
			<span class="mx-2">&middot;</span>
			<a href="/about" class="hover:text-white">About</a>
			<span class="mx-2">&middot;</span>
			<a href="/developers" class="hover:text-white">Developers</a>
			<span class="mx-2">&middot;</span>
			<a href="/checks" class="hover:text-white">Checks</a>
			<span class="mx-2">&middot;</span>
			<a href="/guides/website-launch-checklist" class="hover:text-white">Guides</a>
			<span class="mx-2">&middot;</span>
			<a href="/changelog" class="hover:text-white">Changelog</a>
			<span class="mx-2">&middot;</span>
			<a href="/privacy" class="hover:text-white">Privacy</a>
			<span class="mx-2">&middot;</span>
			<a href="/terms" class="hover:text-white">Terms</a>
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
