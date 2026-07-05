<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';
	import { buildUnlockOffer } from '$lib/client/preflight-session';

	let {
		report,
		checkoutLoading,
		onCheckout
	}: {
		report: ScanReport;
		checkoutLoading: boolean;
		onCheckout: () => void;
	} = $props();

	const offer = $derived(buildUnlockOffer(report));
</script>

{#if offer}
	<section
		class="rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-500/10 via-zinc-900/80 to-zinc-950 p-8"
	>
		<p class="text-xs font-semibold tracking-widest text-sky-400 uppercase">
			Not Lighthouse — launch fixes
		</p>
		<h2 class="mt-2 text-2xl font-bold text-white">{offer.headline}</h2>
		<p class="mt-2 max-w-2xl text-zinc-400">{offer.subhead}</p>
		<p class="mt-3 text-sm font-medium text-sky-300">{offer.valuePitch}</p>

		{#if offer.projectedScore != null}
			<p class="mt-2 text-sm text-zinc-500">
				Typical after fixes: re-scan shows
				<span class="font-mono text-zinc-300">{report.score} → {offer.projectedScore}</span>
				(+{offer.projectedScore - report.score}) — proof before you post on X or Product Hunt.
			</p>
		{/if}

		{#if offer.issueCount > 0}
			<div class="mt-6 flex flex-wrap gap-3 text-sm">
				{#if offer.blockerCount > 0}
					<span class="rounded-full bg-red-500/20 px-3 py-1 font-medium text-red-300">
						{offer.blockerCount} launch blocker{offer.blockerCount === 1 ? '' : 's'}
					</span>
				{/if}
				<span class="rounded-full bg-zinc-800 px-3 py-1 text-zinc-300">
					{offer.issueCount} issue{offer.issueCount === 1 ? '' : 's'} with fix prompts
				</span>
				{#if offer.lockedPromptCount > 0}
					<span class="rounded-full bg-sky-500/20 px-3 py-1 font-medium text-sky-300">
						{offer.lockedPromptCount} locked{#if offer.hasSample}
							· 1 free sample{/if}
					</span>
				{/if}
			</div>
		{/if}

		<ul class="mt-6 grid gap-3 sm:grid-cols-2">
			<li class="flex gap-2 text-sm text-zinc-300">
				<span class="text-sky-400">✓</span>
				Every fix prompt — copy into Cursor or Claude
			</li>
			<li class="flex gap-2 text-sm text-zinc-300">
				<span class="text-sky-400">✓</span>
				One master paste — fix everything in Cursor
				{#if offer.masterPromptLineCount > 0}
					<span class="text-zinc-500">({offer.masterPromptLineCount} lines)</span>
				{/if}
			</li>
			<li class="flex gap-2 text-sm text-zinc-300">
				<span class="text-sky-400">✓</span>
				Unlimited re-scans — prove score went up before you post
			</li>
			<li class="flex gap-2 text-sm text-zinc-300">
				<span class="text-sky-400">✓</span>
				One-time $9 for this URL — not a subscription
			</li>
		</ul>

		<div class="mt-8 flex flex-wrap items-center gap-4">
			<div>
				<p class="text-3xl font-bold text-white">$9</p>
				<p class="text-sm text-zinc-500">One-time · this URL only</p>
			</div>
			<button
				type="button"
				disabled={checkoutLoading}
				class="rounded-xl bg-sky-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500 disabled:opacity-50"
				onclick={onCheckout}
			>
				{checkoutLoading ? 'Redirecting to checkout…' : offer.ctaLabel}
			</button>
		</div>
		<p class="mt-4 text-xs text-zinc-600">
			You already see what's wrong for free. Pay once when you're ready to fix it and prove the
			improvement.
		</p>
	</section>
{/if}
