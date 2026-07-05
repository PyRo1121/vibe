<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';
	import { buildUnlockOffer } from '$lib/client/preflight-session';
	import { DEPLOYLINT_PLAN_LIST, type DeploylintPlanId } from '$lib/product/plans';

	let {
		report,
		checkoutLoading,
		onCheckout
	}: {
		report: ScanReport;
		checkoutLoading: boolean;
		onCheckout: (plan: DeploylintPlanId) => void;
	} = $props();

	const offer = $derived(buildUnlockOffer(report));
</script>

{#if offer}
	<section
		class="rounded-2xl border border-sky-500/40 bg-gradient-to-br from-sky-500/10 via-zinc-900/80 to-zinc-950 p-8"
	>
		<p class="text-xs font-semibold tracking-widest text-sky-400 uppercase">
			Not Lighthouse - launch fixes
		</p>
		<h2 class="mt-2 text-2xl font-bold text-white">{offer.headline}</h2>
		<p class="mt-2 max-w-2xl text-zinc-400">{offer.subhead}</p>
		<p class="mt-3 text-sm font-medium text-sky-300">{offer.valuePitch}</p>

		{#if offer.projectedScore != null}
			<p class="mt-2 text-sm text-zinc-500">
				Typical after fixes: re-scan shows
				<span class="font-mono text-zinc-300">{report.score} -> {offer.projectedScore}</span>
				(+{offer.projectedScore - report.score}) - proof before you post on X or Product Hunt.
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
							- 1 free sample{/if}
					</span>
				{/if}
			</div>
		{/if}

		<ul class="mt-6 grid gap-3 sm:grid-cols-2">
			<li class="flex gap-2 text-sm text-zinc-300">
				<span class="text-sky-400">✓</span>
				Every fix prompt - copy into Cursor or Claude
			</li>
			<li class="flex gap-2 text-sm text-zinc-300">
				<span class="text-sky-400">✓</span>
				One master paste - fix everything in Cursor
				{#if offer.masterPromptLineCount > 0}
					<span class="text-zinc-500">({offer.masterPromptLineCount} lines)</span>
				{/if}
			</li>
			<li class="flex gap-2 text-sm text-zinc-300">
				<span class="text-sky-400">✓</span>
				Re-scan proof - show the score moved before you post
			</li>
			<li class="flex gap-2 text-sm text-zinc-300">
				<span class="text-sky-400">✓</span>
				Monitoring, MCP access, and deploy gate by plan
			</li>
		</ul>

		<div class="mt-8 grid gap-3 lg:grid-cols-3">
			{#each DEPLOYLINT_PLAN_LIST as plan (plan.id)}
				<div
					class="rounded-xl border p-4 {plan.id === 'solo'
						? 'border-sky-500/50 bg-sky-500/10'
						: 'border-zinc-800 bg-zinc-950/70'}"
				>
					<div class="flex items-baseline justify-between gap-2">
						<p class="font-semibold text-white">{plan.name}</p>
						<p class="text-xl font-bold text-white">{plan.priceLabel}</p>
					</div>
					<p class="mt-1 text-xs text-zinc-500">{plan.limits} - {plan.cadence}</p>
					<p class="mt-2 text-sm text-zinc-400">{plan.tagline}</p>
					<ul class="mt-3 space-y-1.5 text-xs text-zinc-400">
						{#each plan.features as feature (feature)}
							<li class="flex gap-2">
								<span class="text-sky-400">+</span>
								<span>{feature}</span>
							</li>
						{/each}
					</ul>
					<button
						type="button"
						disabled={checkoutLoading}
						class="mt-4 w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
						onclick={() => onCheckout(plan.id)}
					>
						{checkoutLoading ? 'Redirecting...' : plan.ctaLabel}
					</button>
				</div>
			{/each}
		</div>
		<p class="mt-4 text-xs text-zinc-600">
			Subscriptions use Stripe Checkout. Free scans stay available; paid plans unlock all prompts,
			MCP workflow access, and recurring launch monitoring for the selected project limit.
		</p>
	</section>
{/if}
