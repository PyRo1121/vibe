<script lang="ts">
	import AiCopyReviewPanel from '$lib/components/AiCopyReviewPanel.svelte';
	import Checklist from '$lib/components/Checklist.svelte';
	import DeepDivesSection from '$lib/components/DeepDivesSection.svelte';
	import LaunchBriefPanel from '$lib/components/LaunchBriefPanel.svelte';
	import MasterPromptPanel from '$lib/components/MasterPromptPanel.svelte';
	import PagesScannedStrip from '$lib/components/PagesScannedStrip.svelte';
	import PostUnlockGuide from '$lib/components/PostUnlockGuide.svelte';
	import ReportSummary from '$lib/components/ReportSummary.svelte';
	import RepoSummaryPanel from '$lib/components/RepoSummaryPanel.svelte';
	import ScanIncompleteBanner from '$lib/components/ScanIncompleteBanner.svelte';
	import UnlockComparePanel from '$lib/components/UnlockComparePanel.svelte';
	import UnlockPanel from '$lib/components/UnlockPanel.svelte';
	import UnlockStickyBar from '$lib/components/UnlockStickyBar.svelte';
	import VerdictBanner from '$lib/components/VerdictBanner.svelte';
	import type { DeploylintPlanId } from '$lib/product/plans';
	import type { ScanReport } from '$lib/scan/types';

	type Props = {
		alphaFreeUnlock: boolean;
		billingPortalLoading: boolean;
		checkoutLoading: boolean;
		copiedId: string | null;
		loading: boolean;
		permalink: string | null;
		report: ScanReport;
		shareCopied: boolean;
		unlockSessionId: string | null;
		onCheckout: (plan: DeploylintPlanId) => void;
		onCopyPrompt: (id: string, text: string) => void;
		onOpenBillingPortal: () => void;
		onRescan: () => void;
		onShare: () => void;
	};

	let {
		alphaFreeUnlock,
		billingPortalLoading,
		checkoutLoading,
		copiedId,
		loading,
		permalink,
		report,
		shareCopied,
		unlockSessionId,
		onCheckout,
		onCopyPrompt,
		onOpenBillingPortal,
		onRescan,
		onShare
	}: Props = $props();
</script>

{#if alphaFreeUnlock}
	<section
		class="mb-6 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-5 print:hidden"
		aria-label="Unlocked report notice"
	>
		<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
			Free workspace access
		</p>
		<p class="mt-2 text-sm text-zinc-300">
			Your plan includes the repair plan, workspace workflow, copy readiness review, and
			verify-fixes proof shown below.
		</p>
	</section>
{/if}

{#if report.unlocked && unlockSessionId && !alphaFreeUnlock}
	<section
		class="mb-6 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:flex-row sm:items-center sm:justify-between print:hidden"
		aria-label="Billing self-service"
	>
		<div>
			<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
				Subscription active
			</p>
			<p class="mt-1 text-sm text-zinc-400">
				Manage invoices, payment methods, cancellation, and plan changes in Stripe.
			</p>
		</div>
		<button
			type="button"
			disabled={billingPortalLoading}
			class="shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:border-sky-500 hover:text-sky-200 disabled:opacity-50"
			onclick={onOpenBillingPortal}
		>
			{billingPortalLoading ? 'Opening...' : 'Manage billing'}
		</button>
	</section>
{/if}

<VerdictBanner {report} />
<RepoSummaryPanel {report} />
<ScanIncompleteBanner {report} />
<PagesScannedStrip {report} />

{#if report.scanCoverage !== 'blocked'}
	<ReportSummary {report} {loading} {shareCopied} {onShare} {onRescan} {permalink} />
{/if}

<LaunchBriefPanel {report} />
<PostUnlockGuide {report} />

{#if report.unlocked && report.masterPrompt}
	<MasterPromptPanel
		masterPrompt={report.masterPrompt}
		copied={copiedId === 'master'}
		onCopy={() => onCopyPrompt('master', report.masterPrompt ?? '')}
	/>
{/if}

<AiCopyReviewPanel
	{report}
	{alphaFreeUnlock}
	copied={copiedId === 'ai-copy'}
	onCopy={(text) => onCopyPrompt('ai-copy', text)}
/>
<Checklist {report} {copiedId} {onCopyPrompt} />
<DeepDivesSection {report} />

{#if !report.unlocked}
	<div class="pb-20 md:pb-0 print:hidden">
		<UnlockComparePanel {report} {checkoutLoading} {onCheckout} />
		<UnlockPanel {report} {checkoutLoading} {onCheckout} />
	</div>
	<UnlockStickyBar {report} {checkoutLoading} {onCheckout} />
{/if}
