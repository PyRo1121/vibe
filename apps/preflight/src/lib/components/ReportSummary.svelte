<script lang="ts">
	import { resolve } from '$app/paths';
	import { computeFixProgress, loadBaselineChecks } from '$lib/client/preflight-session';
	import ScoreDeltaBadge from '$lib/components/ScoreDeltaBadge.svelte';
	import type { PaymentReadinessStatus, ScanReport } from '$lib/scan/types';
	import { scoreColor } from '$lib/ui/scan-styles';

	let {
		report,
		loading,
		shareCopied,
		onShare,
		onRescan,
		permalink = null
	}: {
		report: ScanReport;
		loading: boolean;
		shareCopied: boolean;
		onShare: () => void;
		onRescan: () => void;
		permalink?: string | null;
	} = $props();

	const categories = $derived(report.launchBrief?.categoryScores ?? []);
	const paymentReadiness = $derived(report.paymentReadiness ?? null);

	const fixProgress = $derived.by(() => {
		const baseline = loadBaselineChecks();
		if (baseline?.length) return computeFixProgress(baseline, report.checks);
		return null;
	});

	let linkCopied = $state(false);
	let linkTimer: ReturnType<typeof setTimeout> | undefined;
	let badgeCopied = $state(false);
	let badgeTimer: ReturnType<typeof setTimeout> | undefined;
	let briefCopied = $state(false);
	let briefTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyPermalink() {
		if (!permalink) return;
		await navigator.clipboard.writeText(permalink);
		linkCopied = true;
		clearTimeout(linkTimer);
		linkTimer = setTimeout(() => (linkCopied = false), 2000);
	}

	async function copyBriefLink() {
		if (!permalink) return;
		await navigator.clipboard.writeText(`${permalink}?view=brief`);
		briefCopied = true;
		clearTimeout(briefTimer);
		briefTimer = setTimeout(() => (briefCopied = false), 2000);
	}

	async function copyBadge() {
		if (!permalink) return;
		await navigator.clipboard.writeText(
			`[![Deploylint score](${permalink}/badge.svg)](${permalink})`
		);
		badgeCopied = true;
		clearTimeout(badgeTimer);
		badgeTimer = setTimeout(() => (badgeCopied = false), 2000);
	}

	function barColor(score: number): string {
		if (score >= 80) return 'bg-emerald-500';
		if (score >= 60) return 'bg-amber-500';
		return 'bg-red-500';
	}

	function paymentTone(status: PaymentReadinessStatus): string {
		if (status === 'ready') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
		if (status === 'needs-attention') return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
		return 'border-red-500/30 bg-red-500/10 text-red-200';
	}

	function blockerLabel(count: number): string {
		return `${count} revenue blocker${count === 1 ? '' : 's'}`;
	}
</script>

<section class="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
	<div class="grid gap-8 lg:grid-cols-[minmax(0,320px)_1fr]">
		<div>
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Deploy risk score</p>
			<div class="mt-1 flex items-baseline gap-3">
				<p class="text-6xl font-bold tabular-nums {scoreColor(report.score)}">{report.score}</p>
				<p class="text-lg text-zinc-600">/100</p>
			</div>
			{#if report.scoreDelta != null && report.previousScore != null}
				<div class="mt-2">
					<ScoreDeltaBadge
						previousScore={report.previousScore}
						score={report.score}
						scoreDelta={report.scoreDelta}
						fixedCount={report.scanDiff?.fixed.length ?? fixProgress?.fixedCount ?? null}
						fixedBlockerCount={fixProgress?.fixedBlockerCount ?? null}
						compact
					/>
				</div>
			{/if}

			{#if report.history?.length}
				<div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
					<span class="text-[10px] font-semibold tracking-wider text-zinc-600 uppercase">
						History
					</span>
					{#each report.history as h (h.id)}
						<a
							href={resolve(`/r/${h.id}`)}
							class="rounded bg-zinc-800/70 px-1.5 py-0.5 tabular-nums {scoreColor(
								h.score
							)} hover:bg-zinc-700"
							title={new Date(h.at).toLocaleString()}
						>
							{h.score}
						</a>
						<span class="text-zinc-700">→</span>
					{/each}
					<span class="font-bold tabular-nums {scoreColor(report.score)}">{report.score}</span>
				</div>
			{/if}

			{#if report.scanDiff}
				<div class="mt-2 space-y-0.5 text-xs">
					{#if report.scanDiff.fixed.length > 0}
						<p class="text-emerald-400" title={report.scanDiff.fixed.join(', ')}>
							✓ Fixed since last scan: {report.scanDiff.fixed.slice(0, 3).join(', ')}{report
								.scanDiff.fixed.length > 3
								? ` +${report.scanDiff.fixed.length - 3} more`
								: ''}
						</p>
					{/if}
					{#if report.scanDiff.regressed.length > 0}
						<p class="text-red-400" title={report.scanDiff.regressed.join(', ')}>
							▲ New since last scan: {report.scanDiff.regressed.slice(0, 3).join(', ')}{report
								.scanDiff.regressed.length > 3
								? ` +${report.scanDiff.regressed.length - 3} more`
								: ''}
						</p>
					{/if}
				</div>
			{/if}

			<div class="mt-4 flex flex-wrap gap-2 text-xs font-medium">
				<span class="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
					{report.summary.pass} passed
				</span>
				<span class="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300">
					{report.summary.warn} warnings
				</span>
				<span class="rounded-full bg-red-500/10 px-2.5 py-1 text-red-300">
					{report.summary.fail} failing
				</span>
				{#if report.unlocked}
					<span class="rounded-full bg-sky-500/15 px-2.5 py-1 text-sky-300"
						>Fix & verify unlocked</span
					>
				{/if}
			</div>

			{#if paymentReadiness && paymentReadiness.status !== 'not-detected'}
				<div class="mt-4 rounded-xl border p-3 {paymentTone(paymentReadiness.status)}">
					<p class="text-[10px] font-semibold tracking-wider uppercase">Payment readiness</p>
					<p class="mt-1 text-sm font-medium">{paymentReadiness.headline}</p>
					<div class="mt-2 flex flex-wrap gap-2 text-xs">
						<span>{blockerLabel(paymentReadiness.fail)}</span>
						{#if paymentReadiness.warn > 0}
							<span>{paymentReadiness.warn} warning{paymentReadiness.warn === 1 ? '' : 's'}</span>
						{/if}
						{#if paymentReadiness.pass > 0}
							<span>{paymentReadiness.pass} passed</span>
						{/if}
					</div>
				</div>
			{/if}

			<p class="mt-4 truncate text-xs text-zinc-500" title={report.finalUrl}>
				{report.finalUrl} · {new Date(report.scannedAt).toLocaleString()}
			</p>

			{#if report.stack?.length}
				<div class="mt-3 flex flex-wrap items-center gap-1.5">
					<span class="text-[10px] font-semibold tracking-wider text-zinc-600 uppercase">Stack</span
					>
					{#each report.stack as tech (tech)}
						<span
							class="rounded-full border border-zinc-700/80 bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-300"
						>
							{tech}
						</span>
					{/each}
				</div>
			{/if}

			<div class="mt-4 flex flex-wrap gap-2">
				{#if permalink}
					<button
						type="button"
						class="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20"
						onclick={copyPermalink}
					>
						{linkCopied ? 'Link copied!' : 'Copy report link'}
					</button>
					<button
						type="button"
						class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
						onclick={copyBadge}
						title="Markdown badge for your README"
					>
						{badgeCopied ? 'Copied!' : 'Copy README badge'}
					</button>
					<button
						type="button"
						class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
						onclick={copyBriefLink}
						title="Plain-English summary view for clients and stakeholders"
					>
						{briefCopied ? 'Copied!' : 'Copy stakeholder brief'}
					</button>
				{/if}
				<button
					type="button"
					class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
					onclick={onShare}
				>
					{shareCopied ? 'Copied!' : 'Copy share text'}
				</button>
				<button
					type="button"
					class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
					onclick={() => window.print()}
				>
					Save PDF
				</button>
				{#if report.unlocked}
					<button
						type="button"
						disabled={loading}
						class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
						onclick={onRescan}
					>
						{loading ? 'Scanning…' : 'Re-scan to verify'}
					</button>
				{/if}
			</div>
		</div>

		{#if categories.length > 0}
			<div>
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Where to focus</p>
				<ul class="mt-3 space-y-3">
					{#each categories as row (row.category)}
						<li>
							<div class="mb-1 flex items-baseline justify-between gap-2 text-sm">
								<span class="font-medium text-zinc-200">{row.label}</span>
								<span class="text-xs text-zinc-500">
									{#if row.fail > 0}<span class="text-red-400">{row.fail} failing</span
										>{#if row.warn > 0}<span> · </span>{/if}{/if}{#if row.warn > 0}<span
											class="text-amber-400">{row.warn} warn</span
										>{/if}
									{#if row.fail === 0 && row.warn === 0}<span class="text-emerald-400"
											>all clear</span
										>{/if}
									<span class="ml-2 font-bold tabular-nums {scoreColor(row.score)}"
										>{row.score}</span
									>
								</span>
							</div>
							<div class="h-1.5 overflow-hidden rounded-full bg-zinc-800">
								<div
									class="h-full rounded-full {barColor(row.score)} transition-all"
									style="width: {Math.max(row.score, 3)}%"
								></div>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</section>
