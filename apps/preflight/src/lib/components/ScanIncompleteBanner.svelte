<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';

	let { report }: { report: ScanReport } = $props();
</script>

{#if report.scanCoverage === 'blocked'}
	<section
		class="mb-6 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-5"
		role="alert"
		aria-labelledby="scan-incomplete-heading"
	>
		<p id="scan-incomplete-heading" class="text-sm font-semibold text-amber-200">
			Incomplete scan — content checks skipped
		</p>
		<p class="mt-2 text-sm text-amber-100/90">
			{report.scanCoverageMessage ??
				'The homepage returned an error status. SEO, legal, and social checks were not run — any missing-meta warnings would be from an error page, not your real site.'}
		</p>
		<p class="mt-3 text-xs text-amber-200/80">
			Preflight works best on apps you control (Cloudflare Pages, Vercel, Lovable). Enterprise sites
			that block bots will not scan reliably.
		</p>
	</section>
{/if}
