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
	<div
		class="fixed inset-x-0 bottom-0 z-50 border-t border-sky-500/30 bg-zinc-950/95 px-4 py-3 backdrop-blur md:hidden print:hidden"
		role="region"
		aria-label="Unlock fix prompts"
	>
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-3">
			<div class="min-w-0">
				<p class="truncate text-sm font-medium text-white">{offer.valuePitch}</p>
				<p class="text-xs text-zinc-500">$9 one-time</p>
			</div>
			<button
				type="button"
				disabled={checkoutLoading}
				class="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
				onclick={onCheckout}
			>
				{checkoutLoading ? '…' : 'Unlock'}
			</button>
		</div>
	</div>
{/if}
