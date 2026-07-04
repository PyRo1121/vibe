<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';

	let { report }: { report: ScanReport } = $props();
</script>

{#if report.launchBrief}
	<section class="mb-10 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-zinc-900/60 p-8">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="max-w-2xl">
				<p class="text-xs font-semibold tracking-widest text-sky-400 uppercase">
					Before you post publicly
				</p>
				<h2 class="mt-2 text-2xl font-bold text-white">{report.launchBrief.headline}</h2>
			</div>
			<span
				class="rounded-full px-3 py-1 text-xs font-semibold {report.launchBrief.shareReady
					? 'bg-emerald-500/20 text-emerald-300'
					: 'bg-amber-500/20 text-amber-300'}"
			>
				{report.launchBrief.shareReady ? 'Link preview OK' : 'Link preview at risk'}
			</span>
		</div>

		{#if report.launchBrief.embarrassmentRisks.length > 0}
			<div class="mt-6">
				<p class="mb-3 text-sm font-medium text-zinc-300">What strangers notice first</p>
				<ul class="space-y-2">
					{#each report.launchBrief.embarrassmentRisks as risk, i (i)}
						<li class="flex gap-3 text-sm text-zinc-400">
							<span class="mt-0.5 shrink-0 text-amber-400">⚠</span>
							<span>{risk}</span>
						</li>
					{/each}
				</ul>
				{#if !report.unlocked}
					<p class="mt-4 text-sm text-sky-300/90">
						Free scan shows the problems. Unlock gives you Cursor prompts to fix them — then re-scan to
						prove it.
					</p>
				{/if}
			</div>
		{:else}
			<p class="mt-6 text-sm text-emerald-300">
				No obvious public embarrassment risks on this scan — still worth a re-scan after last-minute
				changes.
			</p>
		{/if}
	</section>
{/if}
