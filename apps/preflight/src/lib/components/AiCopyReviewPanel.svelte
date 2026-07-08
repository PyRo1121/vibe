<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';

	let {
		report,
		alphaFreeUnlock = false,
		copied,
		onCopy
	}: {
		report: ScanReport;
		alphaFreeUnlock?: boolean;
		copied: boolean;
		onCopy: (text: string) => void;
	} = $props();

	const review = $derived(report.aiCopyReview);

	const rewriteText = $derived(
		review ? `${review.headline}${review.subhead ? `\n${review.subhead}` : ''}` : ''
	);
</script>

{#if review}
	<section class="mb-6 rounded-2xl border border-sky-500/25 bg-sky-500/5 p-5 sm:p-6">
		<div class="flex flex-wrap items-baseline gap-2">
			<h2 class="font-semibold text-white">Copy readiness review</h2>
			<span
				class="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-sky-300 uppercase"
			>
				{alphaFreeUnlock ? 'Free in alpha' : 'Included in Solo workspace'}
			</span>
		</div>
		<ul class="mt-3 space-y-2 text-sm text-zinc-300">
			{#each review.bullets as bullet, i (i)}
				<li class="flex gap-2">
					<span class="text-sky-400">•</span>
					<span>{bullet}</span>
				</li>
			{/each}
		</ul>
		<div class="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
			<p class="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
				Recommended hero rewrite
			</p>
			<p class="mt-1 text-lg font-semibold text-white">{review.headline}</p>
			{#if review.subhead}
				<p class="mt-1 text-sm text-zinc-400">{review.subhead}</p>
			{/if}
			<button
				type="button"
				class="mt-3 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
				onclick={() => onCopy(rewriteText)}
			>
				{copied ? 'Copied!' : 'Copy rewrite'}
			</button>
		</div>
	</section>
{/if}
