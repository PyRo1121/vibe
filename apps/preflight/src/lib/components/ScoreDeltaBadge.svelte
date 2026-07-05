<script lang="ts">
	let {
		previousScore,
		score,
		scoreDelta,
		fixedCount = null,
		fixedBlockerCount = null,
		compact = false
	}: {
		previousScore: number;
		score: number;
		scoreDelta: number;
		fixedCount?: number | null;
		fixedBlockerCount?: number | null;
		compact?: boolean;
	} = $props();

	const improved = $derived(scoreDelta > 0);
	const declined = $derived(scoreDelta < 0);
	const arrow = $derived(improved ? '↑' : declined ? '↓' : '→');
	const arrowClass = $derived(
		improved ? 'text-emerald-400' : declined ? 'text-red-400' : 'text-amber-400'
	);
	const borderClass = $derived(
		improved
			? 'border-emerald-500/40 bg-emerald-500/10'
			: declined
				? 'border-red-500/40 bg-red-500/10'
				: 'border-amber-500/40 bg-amber-500/10'
	);
</script>

<div
	class="inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 font-medium {borderClass} {compact
		? 'text-xs'
		: 'text-sm'}"
	role="status"
	aria-label="Score changed from {previousScore} to {score}, {scoreDelta >= 0
		? 'up'
		: 'down'} {Math.abs(scoreDelta)} points"
>
	<span class={arrowClass} aria-hidden="true">{arrow}</span>
	<span class="tabular-nums text-white">
		{previousScore} → {score}
	</span>
	<span class="tabular-nums {arrowClass}">
		({scoreDelta >= 0 ? '+' : ''}{scoreDelta})
	</span>
	{#if fixedBlockerCount != null && fixedBlockerCount > 0}
		<span class="text-emerald-300/90">
			· {fixedBlockerCount} blocker{fixedBlockerCount === 1 ? '' : 's'} fixed
		</span>
	{:else if fixedCount != null && fixedCount > 0}
		<span class="text-emerald-300/90">
			· {fixedCount} fixed
		</span>
	{/if}
</div>
