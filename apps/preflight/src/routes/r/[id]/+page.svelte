<script lang="ts">
	import { page } from '$app/state';
	import VerdictBanner from '$lib/components/VerdictBanner.svelte';
	import RepoSummaryPanel from '$lib/components/RepoSummaryPanel.svelte';
	import ScanIncompleteBanner from '$lib/components/ScanIncompleteBanner.svelte';
	import PagesScannedStrip from '$lib/components/PagesScannedStrip.svelte';
	import ReportSummary from '$lib/components/ReportSummary.svelte';
	import LaunchBriefPanel from '$lib/components/LaunchBriefPanel.svelte';
	import Checklist from '$lib/components/Checklist.svelte';
	import DeepDivesSection from '$lib/components/DeepDivesSection.svelte';
	import { verdictLabels } from '$lib/ui/scan-styles';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const permalink = $derived(`${data.appUrl.replace(/\/$/, '')}/r/${page.params.id}`);
	const briefView = $derived(page.url.searchParams.get('view') === 'brief');
	const failing = $derived(report.checks.filter((c) => c.status === 'fail'));
	const warnings = $derived(report.checks.filter((c) => c.status === 'warn'));

	let shareCopied = $state(false);
	let copiedId = $state<string | null>(null);

	async function copyLink() {
		await navigator.clipboard.writeText(permalink);
		shareCopied = true;
		setTimeout(() => (shareCopied = false), 2000);
	}

	async function copyPrompt(id: string, text: string) {
		await navigator.clipboard.writeText(text);
		copiedId = id;
		setTimeout(() => {
			if (copiedId === id) copiedId = null;
		}, 2000);
	}

	const pageTitle = $derived(
		`Deploylint report — ${verdictLabels[report.verdict]} ${report.score}/100 — ${report.finalUrl}`
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta
		name="description"
		content="Launch readiness report: {report.summary.fail} failing, {report.summary
			.warn} warnings, {report.summary.pass} passing."
	/>
	<meta name="robots" content="noindex" />
	<meta property="og:title" content={pageTitle} />
	<meta
		property="og:description"
		content="Verdict: {verdictLabels[report.verdict]} · score {report.score}/100 · {report.summary
			.fail} failing checks."
	/>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-12">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-xs font-semibold tracking-widest text-sky-400 uppercase">Shared report</p>
			<p class="mt-1 text-sm text-zinc-400">
				Scanned {new Date(report.scannedAt).toLocaleString()} · kept for 90 days
			</p>
		</div>
		<a
			href="/"
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
		>
			Scan your own site free →
		</a>
	</div>

	{#if briefView}
		<VerdictBanner {report} />
		<LaunchBriefPanel {report} />

		<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
			<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="text-xl font-semibold text-white">Status at a glance</h2>
				<p class="text-sm text-zinc-400">
					Score {report.score}/100 · {failing.length} blocking · {warnings.length} to improve · {report
						.summary.pass} passing
				</p>
			</div>
			{#if failing.length > 0}
				<h3 class="mb-2 text-sm font-semibold text-red-400">Must fix before launch</h3>
				<ul class="mb-4 space-y-1.5">
					{#each failing as check (check.id)}
						<li class="text-sm text-zinc-300">
							<span class="font-medium text-white">{check.title}</span>
							<span class="text-zinc-500"> — {check.message}</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if warnings.length > 0}
				<h3 class="mb-2 text-sm font-semibold text-amber-400">Worth improving</h3>
				<ul class="space-y-1.5">
					{#each warnings as check (check.id)}
						<li class="text-sm text-zinc-300">
							<span class="font-medium text-white">{check.title}</span>
							<span class="text-zinc-500"> — {check.message}</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if failing.length === 0 && warnings.length === 0}
				<p class="text-sm text-emerald-400">Everything we checked passed. Clear to launch.</p>
			{/if}
		</section>

		<p class="mb-10 text-center text-sm text-zinc-500">
			This is the summary view for stakeholders.
			<a class="text-sky-400 hover:underline" href={permalink}>See the full technical report →</a>
		</p>
	{:else}
		<VerdictBanner {report} />
		<RepoSummaryPanel {report} />
		<ScanIncompleteBanner {report} />
		<PagesScannedStrip {report} />
		{#if report.scanCoverage !== 'blocked'}
			<ReportSummary
				{report}
				loading={false}
				{shareCopied}
				onShare={copyLink}
				onRescan={() => {}}
				{permalink}
			/>
		{/if}
		<LaunchBriefPanel {report} />
		<Checklist {report} {copiedId} onCopyPrompt={copyPrompt} />
		<DeepDivesSection {report} />
	{/if}

	<section class="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-6 text-center">
		<p class="font-medium text-white">Want fix prompts for these issues?</p>
		<p class="mt-1 text-sm text-zinc-400">
			Run your own scan — free verdict in seconds, $9 unlocks every Cursor fix prompt and re-scan
			proof.
		</p>
		<a
			href="/"
			class="mt-4 inline-block rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
		>
			Run a free scan
		</a>
	</section>
</div>
