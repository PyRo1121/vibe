<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { resolve as resolvePath } from '$app/paths';
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
			<a
				href={resolvePath('/')}
				class="flex flex-col leading-none transition-opacity hover:opacity-90"
			>
				<span class="text-lg font-semibold tracking-tight text-white">Deploylint</span>
			</a>
			<nav
				aria-label="Main navigation"
				class="flex items-center gap-3 text-xs text-zinc-300 sm:gap-4"
			>
				<a href={resolvePath('/app')} class="font-medium text-sky-300 hover:text-sky-200"
					>Workspace</a
				>
				<a href={resolvePath('/tools')} class="hover:text-white">Tools</a>
				<a href={resolvePath('/compare')} class="hidden hover:text-white sm:inline">Compare</a>
				<a href={resolvePath('/checks')} class="hidden hover:text-white sm:inline">Checks</a>
				<a
					href={resolvePath('/guides/website-launch-checklist')}
					class="hidden hover:text-white sm:inline">Guides</a
				>
				<a href={resolvePath('/developers')} class="hover:text-white">CI gate</a>
				<span class="hidden text-zinc-400 sm:inline">CI hardening &middot; deploy gates</span>
			</nav>
		</div>
	</header>
	<main id="main" class="min-h-[calc(100vh-8rem)]">{@render children()}</main>
	<footer class="border-t border-zinc-800 py-8 text-center text-xs text-zinc-400 print:hidden">
		<p class="mb-2">Built for builders hardening the path from pull request to production.</p>
		<p>
			<a href={resolvePath('/tools')} class="hover:text-white">Tools</a>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/tools/github-actions-security-checker')} class="hover:text-white"
				>GitHub Actions</a
			>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/app')} class="hover:text-white">Workspace</a>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/')} class="hover:text-white">Deploy ops</a>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/about')} class="hover:text-white">About</a>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/developers')} class="hover:text-white">Developers</a>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/checks')} class="hover:text-white">Checks</a>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/guides/website-launch-checklist')} class="hover:text-white">Guides</a>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/changelog')} class="hover:text-white">Changelog</a>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/privacy')} class="hover:text-white">Privacy</a>
			<span class="mx-2">&middot;</span>
			<a href={resolvePath('/terms')} class="hover:text-white">Terms</a>
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
