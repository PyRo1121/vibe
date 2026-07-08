<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Checklist from '$lib/components/Checklist.svelte';
	import DeepDivesSection from '$lib/components/DeepDivesSection.svelte';
	import LaunchBriefPanel from '$lib/components/LaunchBriefPanel.svelte';
	import PagesScannedStrip from '$lib/components/PagesScannedStrip.svelte';
	import ReportSummary from '$lib/components/ReportSummary.svelte';
	import RepoSummaryPanel from '$lib/components/RepoSummaryPanel.svelte';
	import ScanIncompleteBanner from '$lib/components/ScanIncompleteBanner.svelte';
	import ScoreDeltaBadge from '$lib/components/ScoreDeltaBadge.svelte';
	import VerdictBanner from '$lib/components/VerdictBanner.svelte';
	import { resolvePriority } from '$lib/scan/verdict';
	import { verdictLabels } from '$lib/ui/scan-styles';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const report = $derived(data.report);
	const permalink = $derived(`${data.appUrl.replace(/\/$/, '')}/r/${page.params.id}`);
	const briefView = $derived(page.url.searchParams.get('view') === 'brief');
	const failing = $derived(report.checks.filter((c) => c.status === 'fail'));
	const gateBlockers = $derived(failing.filter((c) => resolvePriority(c) === 'p0'));
	const importantIssues = $derived(failing.filter((c) => resolvePriority(c) !== 'p0'));
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
		`Deploylint readiness brief - ${verdictLabels[report.verdict]} ${report.score}/100 - ${report.finalUrl}`
	);
	const badgeUrl = $derived(`${permalink}/badge.svg`);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta
		name="description"
		content="Deploy readiness report: {report.summary.fail} failing, {report.summary
			.warn} warnings, {report.summary.pass} passing."
	/>
	<meta name="robots" content="noindex, follow" />
	<meta name="googlebot" content="noindex, follow" />
	<link rel="canonical" href={permalink} />
	<meta property="og:title" content={pageTitle} />
	<meta
		property="og:description"
		content="Verdict: {verdictLabels[report.verdict]} · score {report.score}/100 · {report.summary
			.fail} failing checks."
	/>
	<meta property="og:url" content={permalink} />
	<meta property="og:image" content={badgeUrl} />
	<meta property="og:image:alt" content="Deploylint readiness score badge" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={badgeUrl} />
	<meta name="twitter:image:alt" content="Deploylint readiness score badge" />
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-12">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<div>
			<p class="text-xs font-semibold tracking-widest text-sky-400 uppercase">Readiness brief</p>
			<p class="mt-1 text-sm text-zinc-400">
				Reviewed {new Date(report.scannedAt).toLocaleString()} · kept for 90 days
			</p>
		</div>
		<a
			href={resolve('/app#install')}
			class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
		>
			Create workspace from this brief
		</a>
	</div>

	{#if briefView}
		<VerdictBanner {report} />
		<LaunchBriefPanel {report} />

		<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
			<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="text-xl font-semibold text-white">Status at a glance</h2>
				<p class="text-sm text-zinc-400">
					Score {report.score}/100 · {gateBlockers.length} gate blockers · {importantIssues.length}
					issues · {warnings.length} to improve · {report.summary.pass} passing
				</p>
			</div>
			{#if gateBlockers.length > 0}
				<h3 class="mb-2 text-sm font-semibold text-red-400">P0 gate blockers</h3>
				<ul class="mb-4 space-y-1.5">
					{#each gateBlockers as check (check.id)}
						<li class="text-sm text-zinc-300">
							<span class="font-medium text-white">{check.title}</span>
							<span class="text-zinc-500"> — {check.message}</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if importantIssues.length > 0}
				<h3 class="mb-2 text-sm font-semibold text-orange-300">
					Important issues before broad rollout
				</h3>
				<ul class="mb-4 space-y-1.5">
					{#each importantIssues as check (check.id)}
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
			{#if gateBlockers.length === 0 && importantIssues.length === 0 && warnings.length === 0}
				<p class="text-sm text-emerald-400">
					Everything we checked passed. Ready for deploy gate review.
				</p>
			{/if}
		</section>

		<p class="mb-10 text-center text-sm text-zinc-500">
			This is the summary view for stakeholders.
			<a class="text-sky-400 hover:underline" href={resolve(`/r/${page.params.id}`)}
				>See the full technical brief →</a
			>
		</p>
	{:else}
		<VerdictBanner {report} />
		{#if report.scoreDelta != null && report.previousScore != null}
			<div class="mb-4">
				<ScoreDeltaBadge
					previousScore={report.previousScore}
					score={report.score}
					scoreDelta={report.scoreDelta}
				/>
			</div>
		{/if}
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
		<p class="font-medium text-white">Turn this brief into an advisory workflow</p>
		<p class="mt-1 text-sm text-zinc-400">
			Create a workspace, install the advisory workflow, and let future pull requests build
			readiness history before you switch to a blocking deploy gate.
		</p>
		<a
			href={resolve('/app#install')}
			class="mt-4 inline-block rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
		>
			Install advisory workflow
		</a>
	</section>
</div>
