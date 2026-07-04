<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';
	import { verdictClass, verdictLabels } from '$lib/ui/scan-styles';

	let { report }: { report: ScanReport } = $props();

	const deltaImproved = $derived(
		report.scoreDelta != null && report.previousScore != null && report.scoreDelta > 0
	);
	const deltaFlat = $derived(
		report.scoreDelta != null && report.previousScore != null && report.scoreDelta === 0
	);
</script>

<section class="mb-6 rounded-2xl border p-6 {verdictClass(report.verdict)}">
	<p class="text-xs font-semibold tracking-widest uppercase opacity-80">Launch verdict</p>
	<p class="mt-1 text-3xl font-bold">{verdictLabels[report.verdict]}</p>
	<p class="mt-2 text-sm opacity-90">{report.verdictMessage}</p>
	{#if report.scoreDelta != null && report.previousScore != null}
		<div class="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" role="status">
			<p class="font-medium">Re-scan verification</p>
			<p class="mt-1 opacity-90">
				{report.previousScore} → {report.score}
				({report.scoreDelta >= 0 ? '+' : ''}{report.scoreDelta} points)
			</p>
			{#if deltaImproved}
				<p class="mt-1 text-emerald-200">Score improved — keep fixing until verdict is GO.</p>
			{:else if deltaFlat}
				<p class="mt-1 text-amber-200">
					No score change yet — apply fix prompts and re-scan again.
				</p>
			{:else}
				<p class="mt-1 text-amber-200">Score dropped — review recent changes before sharing.</p>
			{/if}
		</div>
	{/if}
</section>
