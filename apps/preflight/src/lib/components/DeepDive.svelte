<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		hint = '',
		badge = null,
		open = false,
		children
	}: {
		title: string;
		hint?: string;
		/** Short status chip, e.g. "1 issue" or "all clear". */
		badge?: { label: string; tone: 'ok' | 'warn' } | null;
		open?: boolean;
		children: Snippet;
	} = $props();
</script>

<details class="group mb-4" {open}>
	<summary
		class="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 select-none hover:bg-zinc-900/60 [&::-webkit-details-marker]:hidden"
	>
		<span
			class="text-xs text-zinc-500 transition-transform duration-150 group-open:rotate-90"
			aria-hidden="true">▶</span
		>
		<span class="font-medium text-white">{title}</span>
		{#if badge}
			<span
				class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase {badge.tone === 'warn'
					? 'bg-amber-500/15 text-amber-300'
					: 'bg-emerald-500/15 text-emerald-300'}"
			>
				{badge.label}
			</span>
		{/if}
		{#if hint}
			<span class="hidden truncate text-xs text-zinc-500 sm:inline">{hint}</span>
		{/if}
		<span class="ml-auto text-xs text-zinc-600 group-open:hidden">Show</span>
		<span class="ml-auto hidden text-xs text-zinc-600 group-open:inline">Hide</span>
	</summary>
	<div class="mt-3">
		{@render children()}
	</div>
</details>
