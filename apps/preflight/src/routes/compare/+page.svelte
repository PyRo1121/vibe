<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const title = buildSeoTitle('Deploylint vs CI security tools');
	const description =
		'Compare Deploylint with manual checklists, GitHub-native controls, SAST and IaC scanners, and Lighthouse for CI hardening, deploy gates, and repo hygiene.';
	const canonical = $derived(`${base}/compare`);
	const jsonLd = $derived([buildPageJsonLd({ base, canonical, title, description })]);

	type Cell = 'yes' | 'partial' | 'no';

	const rows: Array<{
		feature: string;
		deploylint: Cell;
		checklists: Cell;
		githubNative: Cell;
		securityScanners: Cell;
		note?: string;
	}> = [
		{
			feature: 'GitHub Actions workflow risk review',
			deploylint: 'yes',
			checklists: 'partial',
			githubNative: 'partial',
			securityScanners: 'partial',
			note: 'Focuses on risky permissions, pull_request_target, floating refs, and missing quality gates.'
		},
		{
			feature: 'Advisory CI report before blocking',
			deploylint: 'yes',
			checklists: 'no',
			githubNative: 'partial',
			securityScanners: 'partial',
			note: 'Start non-blocking, then gate once the signal is trusted.'
		},
		{
			feature: 'Deploy gate for builder launch blockers',
			deploylint: 'yes',
			checklists: 'no',
			githubNative: 'partial',
			securityScanners: 'partial'
		},
		{
			feature: 'Repo hygiene for agent-built apps',
			deploylint: 'yes',
			checklists: 'partial',
			githubNative: 'no',
			securityScanners: 'partial',
			note: 'Checks scripts, lockfiles, runtime pins, env mistakes, dependency signals, and license risk.'
		},
		{
			feature: 'Public deploy target checks',
			deploylint: 'yes',
			checklists: 'partial',
			githubNative: 'no',
			securityScanners: 'no',
			note: 'Covers crawler, trust, payment, preview, legal, and public exposure issues after CI is under control.'
		},
		{
			feature: 'Agent-ready fix prompts and snippets',
			deploylint: 'yes',
			checklists: 'no',
			githubNative: 'no',
			securityScanners: 'partial'
		},
		{
			feature: 'Before and after proof for fixes',
			deploylint: 'yes',
			checklists: 'no',
			githubNative: 'partial',
			securityScanners: 'partial'
		},
		{
			feature: 'Deep code, cloud, and infrastructure analysis',
			deploylint: 'partial',
			checklists: 'no',
			githubNative: 'partial',
			securityScanners: 'yes',
			note: 'Use dedicated security scanners for deep AppSec and cloud posture work.'
		},
		{
			feature: 'Performance lab and Core Web Vitals',
			deploylint: 'partial',
			checklists: 'no',
			githubNative: 'no',
			securityScanners: 'no',
			note: 'Use Lighthouse or a RUM tool for deep performance budgets.'
		}
	];

	const cellLabel: Record<Cell, string> = {
		yes: 'Yes',
		partial: 'Partial',
		no: 'No'
	};

	const cellClass: Record<Cell, string> = {
		yes: 'text-emerald-400',
		partial: 'text-amber-400',
		no: 'text-zinc-500'
	};
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-5xl px-4 py-12 text-zinc-300">
	<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
		Deploy control, not another audit score
	</p>
	<h1 class="mb-4 text-3xl font-bold text-white sm:text-4xl">How Deploylint compares</h1>
	<p class="mb-8 max-w-3xl text-lg leading-8 text-zinc-400">
		Deploylint sits between manual checklists and heavyweight security tooling. It gives fast
		builders a CI-first loop: review workflow risk, add an advisory report, fix the highest-risk
		findings, then turn clean signal into a deploy gate.
	</p>

	<div class="overflow-x-auto rounded-2xl border border-zinc-800">
		<table class="w-full min-w-[860px] border-collapse text-left text-sm">
			<caption class="sr-only">
				Feature comparison between Deploylint, manual checklists, GitHub-native controls, and
				security scanners
			</caption>
			<thead>
				<tr class="border-b border-zinc-800 bg-zinc-900/60">
					<th scope="col" class="px-4 py-3 font-semibold text-white">What you need</th>
					<th scope="col" class="px-4 py-3 font-semibold text-sky-300">Deploylint</th>
					<th scope="col" class="px-4 py-3 font-semibold text-zinc-400">Manual checklists</th>
					<th scope="col" class="px-4 py-3 font-semibold text-zinc-400">GitHub native</th>
					<th scope="col" class="px-4 py-3 font-semibold text-zinc-400">SAST / IaC scanners</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.feature)}
					<tr class="border-b border-zinc-800/80 align-top">
						<th scope="row" class="px-4 py-3 font-medium text-zinc-200">
							{row.feature}
							{#if row.note}
								<p class="mt-1 text-xs font-normal text-zinc-500">{row.note}</p>
							{/if}
						</th>
						<td class="px-4 py-3 {cellClass[row.deploylint]}">{cellLabel[row.deploylint]}</td>
						<td class="px-4 py-3 {cellClass[row.checklists]}">{cellLabel[row.checklists]}</td>
						<td class="px-4 py-3 {cellClass[row.githubNative]}">
							{cellLabel[row.githubNative]}
						</td>
						<td class="px-4 py-3 {cellClass[row.securityScanners]}">
							{cellLabel[row.securityScanners]}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<section class="mt-10 rounded-2xl border border-sky-900/40 bg-sky-950/20 p-6">
		<h2 class="text-lg font-semibold text-white">When to use what</h2>
		<ul class="mt-3 list-disc space-y-2 pl-6 text-sm leading-6 text-zinc-400">
			<li>
				<strong class="text-zinc-300">Deploylint</strong>: harden GitHub Actions, add advisory CI
				reports, gate risky deploys, and keep builder repos clean.
			</li>
			<li>
				<strong class="text-zinc-300">GitHub native controls</strong>: keep branch protection,
				secret scanning, dependency review, and CodeQL in place.
			</li>
			<li>
				<strong class="text-zinc-300">SAST and IaC scanners</strong>: use them for deep source,
				infrastructure, and cloud posture analysis.
			</li>
			<li>
				<strong class="text-zinc-300">Lighthouse</strong>: use it for performance and accessibility
				lab testing; Deploylint is focused on deploy risk.
			</li>
		</ul>
	</section>

	<p class="mt-8">
		<a class="text-sky-400 hover:underline" href="/tools/github-actions-security-checker"
			>Check workflow YAML</a
		>
		<span class="mx-2 text-zinc-600">&middot;</span>
		<a class="text-sky-400 hover:underline" href="/developers">CI gate setup</a>
	</p>
</div>
