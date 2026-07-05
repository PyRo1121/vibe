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
	<section
		class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
		aria-labelledby="unlock-compare-heading"
	>
		<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Why subscribe?</p>

		<h2 id="unlock-compare-heading" class="mt-2 text-xl font-bold text-white">
			Fix everything in one Cursor paste
		</h2>

		<p class="mt-2 text-sm text-zinc-400">
			Free tells you what's wrong. Solo adds every fix prompt, MCP access, recurring monitoring, and
			one master repair prompt you paste once.
		</p>

		<p class="mt-2 text-sm text-sky-300">{offer.valuePitch}</p>

		<div class="mt-6 grid gap-4 md:grid-cols-2">
			<div class="rounded-xl border border-zinc-700 bg-zinc-950/80 p-5">
				<p class="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
					Free scan (you have this)
				</p>

				<ul class="mt-3 space-y-2 text-sm text-zinc-400">
					<li>+ GO / NO-GO verdict + score ({report.score}/100)</li>
					<li>+ Embarrassment brief + social preview</li>
					<li>+ Full checklist - what's failing</li>
					<li>
						+ 1 sample Cursor prompt{#if offer.hasSample}{/if}
					</li>
				</ul>
			</div>

			<div class="rounded-xl border border-sky-500/40 bg-sky-500/5 p-5">
				<p class="text-xs font-semibold tracking-wider text-sky-400 uppercase">
					$9/mo Solo (fix + watch)
				</p>

				<ul class="mt-3 space-y-2 text-sm text-zinc-200">
					<li>
						+ <strong class="text-white">{offer.lockedPromptCount || offer.issueCount}</strong>
						copy-paste fix prompts for Cursor / Claude
					</li>
					<li>
						+ <strong class="text-white">Fix all issues in one Cursor paste</strong>
						{#if offer.masterPromptLineCount > 0}
							- {offer.masterPromptLineCount}-line repair prompt
						{/if}
					</li>
					<li>
						+ <strong class="text-white">Weekly monitoring</strong>
						{#if offer.projectedScore != null}
							- e.g. {report.score} -> {offer.projectedScore} after fixes
						{:else}
							- before/after score delta
						{/if}
					</li>
					<li>+ 1 monitored project - MCP access - cancel anytime</li>
				</ul>
			</div>
		</div>

		<div class="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
			<p class="mb-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
				Preview - master repair prompt
				{#if offer.masterPromptLineCount > 0}
					- {offer.masterPromptLineCount} lines
				{/if}
			</p>

			<div
				class="relative overflow-hidden rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-500"
			>
				{#each offer.masterPreviewLines as line, i (i)}
					<p class:blur-sm={i > 1} class:select-none={i > 1}>{line || ' '}</p>
				{/each}

				<div
					class="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pt-10 pb-3"
				>
					<button
						type="button"
						disabled={checkoutLoading}
						class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
						onclick={() => onCheckout('solo')}
					>
						{checkoutLoading ? 'Redirecting...' : 'Start Solo - $9/mo'}
					</button>
				</div>
			</div>
		</div>
	</section>
{/if}
