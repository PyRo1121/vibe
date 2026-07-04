<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';

	let { report }: { report: ScanReport } = $props();

	const repo = $derived(report.repo);

	function formatStars(stars: number): string {
		if (stars >= 1000) return `${(stars / 1000).toFixed(stars >= 10_000 ? 0 : 1)}k`;
		return String(stars);
	}
</script>

{#if repo}
	<section class="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="min-w-0">
				<p class="text-xs font-semibold tracking-widest text-sky-400 uppercase">Repository scan</p>
				<h2 class="mt-1 truncate text-xl font-bold text-white">
					<a
						href="https://github.com/{repo.owner}/{repo.repo}"
						target="_blank"
						rel="noopener noreferrer"
						class="hover:text-sky-300"
					>
						{repo.owner}<span class="text-zinc-500">/</span>{repo.repo}
					</a>
				</h2>
				{#if repo.description}
					<p class="mt-1 max-w-2xl text-sm text-zinc-400">{repo.description}</p>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-2 text-xs">
				<span class="rounded-full border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-zinc-300">
					{repo.branch}
				</span>
				{#if repo.stars !== null}
					<span class="rounded-full border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-zinc-300">
						★ {formatStars(repo.stars)}
					</span>
				{/if}
				<span
					class="rounded-full px-2.5 py-1 font-semibold {repo.license
						? 'bg-sky-500/15 text-sky-300'
						: 'bg-amber-500/15 text-amber-300'}"
				>
					{repo.license ?? 'No license'}
				</span>
			</div>
		</div>
		<p class="mt-4 text-xs text-zinc-500">
			Pre-deploy audit of the default branch — committed env files, secret patterns in
			{repo.filesSampled.length} sampled {repo.filesSampled.length === 1 ? 'file' : 'files'},
			{#if repo.depCount !== null}{repo.depCount} production
				{repo.depCount === 1 ? 'dependency' : 'dependencies'},{/if}
			license and sell rights, and README quality.
		</p>
	</section>
{/if}
