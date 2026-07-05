<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';
	import ScoreDeltaBadge from '$lib/components/ScoreDeltaBadge.svelte';
	import { computeFixProgress, loadBaselineChecks } from '$lib/client/preflight-session';

	let { report }: { report: ScanReport } = $props();

	const hasVerifiedRescan = $derived(report.scoreDelta != null && report.previousScore != null);

	const showGuide = $derived(
		report.unlocked && !hasVerifiedRescan && report.checks.some((c) => c.status !== 'pass')
	);

	const fixProgress = $derived.by(() => {
		if (!hasVerifiedRescan) return null;
		const baseline = loadBaselineChecks();
		if (baseline?.length) return computeFixProgress(baseline, report.checks);
		if (report.scanDiff) {
			return {
				totalIssues: report.scanDiff.fixed.length + report.scanDiff.regressed.length,
				fixedCount: report.scanDiff.fixed.length,
				fixedBlockerCount: 0,
				fixed: report.scanDiff.fixed,
				regressed: report.scanDiff.regressed
			};
		}
		return null;
	});

	const progressPct = $derived.by(() => {
		if (!fixProgress || fixProgress.totalIssues === 0) return 0;
		return Math.round((fixProgress.fixedCount / fixProgress.totalIssues) * 100);
	});

	const deltaImproved = $derived(report.scoreDelta != null && report.scoreDelta > 0);
	const deltaFlat = $derived(report.scoreDelta != null && report.scoreDelta === 0);
</script>

{#if showGuide}
	<section class="mb-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<p class="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
					Your unlock — fix & prove it
				</p>
				<h2 class="mt-2 text-lg font-semibold text-white">Three steps before you post publicly</h2>
			</div>
			<div
				class="relative flex h-14 w-14 shrink-0 items-center justify-center"
				aria-hidden="true"
				title="Progress updates after re-scan"
			>
				<svg class="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
					<circle cx="18" cy="18" r="15.5" fill="none" class="stroke-zinc-700" stroke-width="3" />
					<circle
						cx="18"
						cy="18"
						r="15.5"
						fill="none"
						class="stroke-emerald-500/40"
						stroke-width="3"
						stroke-dasharray="97.4"
						stroke-dashoffset="97.4"
						stroke-linecap="round"
					/>
				</svg>
				<span class="absolute text-[10px] font-bold text-zinc-500">0%</span>
			</div>
		</div>
		<ol class="mt-4 space-y-3 text-sm text-zinc-300">
			<li class="flex gap-3">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300"
					>1</span
				>
				<span
					>Copy the <strong class="text-white">master repair prompt</strong> below into Cursor or Claude.</span
				>
			</li>
			<li class="flex gap-3">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300"
					>2</span
				>
				<span>Apply the fixes and redeploy your site.</span>
			</li>
			<li class="flex gap-3">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300"
					>3</span
				>
				<span
					>Hit <strong class="text-white">Re-scan to verify</strong> — we'll show your score delta so
					you can post with proof.</span
				>
			</li>
		</ol>
	</section>
{:else if report.unlocked && hasVerifiedRescan && report.previousScore != null && report.scoreDelta != null}
	<section class="mb-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div>
				<p class="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
					Re-scan proof — ready to share
				</p>
				<h2 class="mt-2 text-lg font-semibold text-white">Fix loop complete</h2>
				<div class="mt-3">
					<ScoreDeltaBadge
						previousScore={report.previousScore}
						score={report.score}
						scoreDelta={report.scoreDelta}
						fixedCount={fixProgress?.fixedCount ?? report.scanDiff?.fixed.length ?? null}
						fixedBlockerCount={fixProgress?.fixedBlockerCount ?? null}
					/>
				</div>
				{#if fixProgress && fixProgress.totalIssues > 0}
					<p class="mt-2 text-sm text-emerald-200/90">
						Fixed {fixProgress.fixedCount} of {fixProgress.totalIssues} issue{fixProgress.totalIssues ===
						1
							? ''
							: 's'} from your first scan.
					</p>
				{/if}
			</div>
			<div
				class="relative flex h-14 w-14 shrink-0 items-center justify-center"
				role="img"
				aria-label="{progressPct}% of baseline issues fixed"
			>
				<svg class="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
					<circle cx="18" cy="18" r="15.5" fill="none" class="stroke-zinc-700" stroke-width="3" />
					<circle
						cx="18"
						cy="18"
						r="15.5"
						fill="none"
						class="stroke-emerald-400"
						stroke-width="3"
						stroke-dasharray="97.4"
						stroke-dashoffset={97.4 - (97.4 * progressPct) / 100}
						stroke-linecap="round"
					/>
				</svg>
				<span class="absolute text-[10px] font-bold text-emerald-300">{progressPct}%</span>
			</div>
		</div>
		<ol class="mt-4 space-y-3 text-sm text-zinc-300">
			<li class="flex gap-3">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950"
					>✓</span
				>
				<span>Copied master repair prompt into your editor.</span>
			</li>
			<li class="flex gap-3">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950"
					>✓</span
				>
				<span>Applied fixes and redeployed.</span>
			</li>
			<li class="flex gap-3">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950"
					>✓</span
				>
				<span>
					Re-scanned with verified delta —
					{#if deltaImproved}
						score improved. Post with proof.
					{:else if deltaFlat}
						no score change yet — keep fixing or re-scan after deploy propagates.
					{:else}
						score dropped — review regressions before sharing.
					{/if}
				</span>
			</li>
		</ol>
	</section>
{/if}
