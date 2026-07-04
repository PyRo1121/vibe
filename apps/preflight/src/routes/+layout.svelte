<script lang="ts">
	import './layout.css';

	let { children, data }: { children: import('svelte').Snippet; data: { plausibleDomain?: string | null } } =
		$props();
</script>

<svelte:head>
	{#if data.plausibleDomain}
		<script
			defer
			data-domain={data.plausibleDomain}
			src="https://plausible.io/js/script.js"
		></script>
	{/if}
</svelte:head>

<div class="min-h-screen">
	<header class="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur print:hidden">
		<div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
			<a href="/" class="text-lg font-semibold tracking-tight text-white">Preflight</a>
			<nav class="flex items-center gap-4 text-xs text-zinc-500">
				<a href="/compare" class="hover:text-zinc-300">Compare</a>
				<a href="/developers" class="hover:text-zinc-300">CI gate</a>
				<span class="hidden sm:inline">60+ launch checks · fix & re-scan</span>
			</nav>
		</div>
	</header>
	<main>{@render children()}</main>
	<footer class="border-t border-zinc-800 py-8 text-center text-xs text-zinc-600 print:hidden">
		<p class="mb-2">Built for builders who ship fast and hate public surprises.</p>
		<p>
			<a href="/developers" class="hover:text-zinc-400">Developers</a>
			<span class="mx-2">·</span>
			<a href="/privacy" class="hover:text-zinc-400">Privacy</a>
			<span class="mx-2">·</span>
			<a href="/terms" class="hover:text-zinc-400">Terms</a>
		</p>
	</footer>
</div>
