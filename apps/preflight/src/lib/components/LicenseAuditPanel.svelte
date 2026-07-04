<script lang="ts">
	import type { ScanReport, Sellability } from '$lib/scan/types';

	let { report }: { report: ScanReport } = $props();

	const audit = $derived(report.licenseAudit);

	const BADGE: Record<Sellability, { label: string; classes: string }> = {
		yes: { label: 'OK to sell', classes: 'bg-emerald-500/20 text-emerald-300' },
		conditions: { label: 'Conditions', classes: 'bg-amber-500/20 text-amber-300' },
		unknown: { label: 'Verify license', classes: 'bg-zinc-500/20 text-zinc-300' },
		risk: { label: 'Sell risk', classes: 'bg-red-500/20 text-red-300' }
	};

	const OVERALL: Record<Sellability, { label: string; classes: string }> = {
		yes: { label: 'Clear to sell', classes: 'bg-emerald-500/20 text-emerald-300' },
		conditions: { label: 'Sellable with conditions', classes: 'bg-amber-500/20 text-amber-300' },
		unknown: { label: 'Licenses unverified', classes: 'bg-zinc-500/20 text-zinc-300' },
		risk: { label: 'Do not sell yet', classes: 'bg-red-500/20 text-red-300' }
	};
</script>

{#if audit && report.scanCoverage !== 'blocked'}
	<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="max-w-2xl">
				<p class="text-xs font-semibold tracking-widest text-sky-400 uppercase">
					License &amp; sell rights
				</p>
				<h2 class="mt-2 text-2xl font-bold text-white">Can you charge money for this?</h2>
				<p class="mt-2 text-sm text-zinc-400">{audit.summary}</p>
			</div>
			<span class="rounded-full px-3 py-1 text-xs font-semibold {OVERALL[audit.sellable].classes}">
				{OVERALL[audit.sellable].label}
			</span>
		</div>

		{#if audit.libraries.length > 0}
			<ul class="mt-6 divide-y divide-zinc-800">
				{#each audit.libraries as lib (lib.name)}
					<li class="flex flex-wrap items-start justify-between gap-3 py-3">
						<div class="min-w-0 max-w-xl">
							<p class="text-sm font-medium text-zinc-200">
								{lib.name}{#if lib.version}<span class="text-zinc-500"> · v{lib.version}</span>{/if}
							</p>
							<p class="mt-0.5 text-xs text-zinc-500">
								{lib.license} · seen via {lib.source}
							</p>
							<p class="mt-1 text-xs text-zinc-400">{lib.note}</p>
						</div>
						<span
							class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold {BADGE[lib.sellable]
								.classes}"
						>
							{BADGE[lib.sellable].label}
						</span>
					</li>
				{/each}
			</ul>
			<p class="mt-4 text-xs text-zinc-500">
				{#if report.repo}
					Audited from package.json production dependencies via the npm registry. Transitive
					dependencies are not resolved — run <code>npx license-checker</code> locally before a commercial
					launch.
				{:else}
					Detected from public page assets (CDN scripts, fonts, recognizable filenames). Server-side
					and bundled dependencies are not visible to this scan — run a full dependency audit before
					a commercial launch.
				{/if}
			</p>
		{/if}
	</section>
{/if}
