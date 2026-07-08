<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ScanReport } from '$lib/scan/types';
	import { verdictLabels } from '$lib/ui/scan-styles';

	let { report, permalink, reportId }: { report: ScanReport; permalink: string; reportId: string } =
		$props();

	const badgeMarkdown = $derived(`[![Deploylint score](${permalink}/badge.svg)](${permalink})`);

	let badgeCopied = $state(false);
	let badgeTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyBadgeMarkdown() {
		await navigator.clipboard.writeText(badgeMarkdown);
		badgeCopied = true;
		clearTimeout(badgeTimer);
		badgeTimer = setTimeout(() => (badgeCopied = false), 2000);
	}
</script>

<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="max-w-2xl">
			<p class="text-xs font-semibold tracking-widest text-sky-400 uppercase">Proof kit</p>
			<h2 class="mt-2 text-2xl font-bold text-white">Artifacts for reviewers</h2>
			<p class="mt-2 text-sm text-zinc-400">
				Package the current {verdictLabels[report.verdict].toLowerCase()} decision as a brief, badge,
				and CI workflow path tied to the reviewed target.
			</p>
		</div>
		<p class="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300">
			Score {report.score}/100
		</p>
	</div>

	<div class="mt-5 grid gap-3 md:grid-cols-3">
		<a
			href={resolve(`/r/${reportId}?view=brief`)}
			class="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 hover:border-sky-500/50"
		>
			<p class="text-sm font-semibold text-white">Stakeholder brief</p>
			<p class="mt-1 text-xs text-zinc-500">
				Plain-English status for clients, founders, and release reviewers.
			</p>
		</a>

		<button
			type="button"
			class="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-left hover:border-sky-500/50"
			onclick={copyBadgeMarkdown}
		>
			<p class="text-sm font-semibold text-white">
				{badgeCopied ? 'Badge copied' : 'README badge'}
			</p>
			<p class="mt-1 text-xs text-zinc-500">Markdown badge linking back to this readiness proof.</p>
		</button>

		<a
			href={resolve('/app#install')}
			class="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 hover:border-sky-500/50"
		>
			<p class="text-sm font-semibold text-white">Advisory workflow</p>
			<p class="mt-1 text-xs text-zinc-500">
				Turn the same checks into pull-request evidence before gate mode.
			</p>
		</a>
	</div>
</section>
