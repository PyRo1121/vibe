<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';
	import { ALPHA_FREE_UNLOCK } from '$lib/product/alpha';

	let {
		report,
		copied,
		onCopy
	}: {
		report: ScanReport;
		copied: boolean;
		onCopy: (text: string) => void;
	} = $props();

	const review = $derived(report.aiCopyReview);

	const rewriteText = $derived(
		review ? `${review.headline}${review.subhead ? `\n${review.subhead}` : ''}` : ''
	);
</script>

{#if review}
	<section class="mb-6 rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5 sm:p-6">
		<div class="flex flex-wrap items-baseline gap-2">
			<h2 class="font-semibold text-white">AI copy review</h2>
			<span
				class="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-violet-300 uppercase"
			>
				{ALPHA_FREE_UNLOCK ? 'Free in alpha' : 'Included with unlock'}
			</span>
		</div>
		<ul class="mt-3 space-y-2 text-sm text-zinc-300">
			{#each review.bullets as bullet, i (i)}
				<li class="flex gap-2">
					<span class="text-violet-400">•</span>
					<span>{bullet}</span>
				</li>
			{/each}
		</ul>
		<div class="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
			<p class="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
				Suggested hero rewrite
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
