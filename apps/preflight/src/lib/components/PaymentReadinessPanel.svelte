<script lang="ts">
	import type { PaymentReadinessSummary } from '$lib/scan/types';

	let { paymentReadiness }: { paymentReadiness: PaymentReadinessSummary } = $props();
</script>

<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="max-w-2xl">
			<p class="text-xs font-semibold tracking-widest text-sky-400 uppercase">Revenue readiness</p>
			<h2 class="mt-2 text-2xl font-bold text-white">
				Can customers safely pay and manage access?
			</h2>
			<p class="mt-2 text-sm text-zinc-400">{paymentReadiness.headline}</p>
		</div>
		<div class="grid grid-cols-3 gap-2 text-center text-xs">
			<div class="rounded-lg bg-red-500/10 px-3 py-2 text-red-300">
				<p class="text-lg font-semibold">{paymentReadiness.fail}</p>
				<p>blockers</p>
			</div>
			<div class="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-300">
				<p class="text-lg font-semibold">{paymentReadiness.warn}</p>
				<p>warnings</p>
			</div>
			<div class="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-300">
				<p class="text-lg font-semibold">{paymentReadiness.pass}</p>
				<p>passed</p>
			</div>
		</div>
	</div>

	{#if paymentReadiness.blockers.length > 0}
		<div class="mt-5">
			<p class="text-xs font-semibold tracking-wide text-red-300 uppercase">Revenue blockers</p>
			<ul class="mt-2 space-y-2 text-sm text-zinc-300">
				{#each paymentReadiness.blockers as blocker (blocker)}
					<li class="rounded-lg border border-red-500/20 bg-red-500/5 p-3">{blocker}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if paymentReadiness.warnings.length > 0}
		<div class="mt-5">
			<p class="text-xs font-semibold tracking-wide text-amber-300 uppercase">Warnings</p>
			<ul class="mt-2 space-y-2 text-sm text-zinc-300">
				{#each paymentReadiness.warnings as warning (warning)}
					<li class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">{warning}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if paymentReadiness.checked.length > 0}
		<p class="mt-5 text-xs text-zinc-500">
			Checked {paymentReadiness.checked.length} revenue readiness signal{paymentReadiness.checked
				.length === 1
				? ''
				: 's'}.
		</p>
	{/if}
</section>
