<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';
	import { verdictClass, verdictLabels } from '$lib/ui/scan-styles';
	import ScoreDeltaBadge from '$lib/components/ScoreDeltaBadge.svelte';
	import { computeFixProgress, loadBaselineChecks } from '$lib/client/preflight-session';

	let { report }: { report: ScanReport } = $props();

	const fixProgress = $derived.by(() => {
		const baseline = loadBaselineChecks();
		if (baseline?.length) return computeFixProgress(baseline, report.checks);
		return null;
	});

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
			<div class="mt-2">
				<ScoreDeltaBadge
					previousScore={report.previousScore}
					score={report.score}
					scoreDelta={report.scoreDelta}
					fixedCount={report.scanDiff?.fixed.length ?? fixProgress?.fixedCount ?? null}
					fixedBlockerCount={fixProgress?.fixedBlockerCount ?? null}
				/>
			</div>
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
