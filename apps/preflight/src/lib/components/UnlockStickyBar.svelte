<script lang="ts">
	import { buildUnlockOffer } from '$lib/client/preflight-session';
	import type { DeploylintPlanId } from '$lib/product/plans';
	import type { ScanReport } from '$lib/scan/types';

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
	<div
		class="fixed inset-x-0 bottom-0 z-50 border-t border-sky-500/30 bg-zinc-950/95 px-4 py-3 backdrop-blur md:hidden print:hidden"
		role="region"
		aria-label="Create workspace for repair guidance and gate proof"
	>
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-3">
			<div class="min-w-0">
				<p class="truncate text-sm font-medium text-white">{offer.valuePitch}</p>
				<p class="text-xs text-zinc-500">Solo starts at $9/mo</p>
			</div>
			<button
				type="button"
				disabled={checkoutLoading}
				class="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
				onclick={() => onCheckout('solo')}
			>
				{checkoutLoading ? '…' : 'Start Solo'}
			</button>
		</div>
	</div>
{/if}
