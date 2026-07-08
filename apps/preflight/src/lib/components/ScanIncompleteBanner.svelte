<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';

	let { report }: { report: ScanReport } = $props();
</script>

{#if report.scanCoverage === 'blocked'}
	<section
		class="mb-6 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-5"
		role="alert"
		aria-labelledby="evidence-limited-heading"
	>
		<p id="evidence-limited-heading" class="text-sm font-semibold text-amber-200">
			Deploy target evidence limited
		</p>
		<p class="mt-2 text-sm text-amber-100/90">
			{report.scanCoverageMessage ??
				'The advisory runner could not read the deploy target, so public evidence checks were limited rather than inferred from an error page.'}
		</p>
		<p class="mt-3 text-xs text-amber-200/80">
			Deploylint works best on apps you control (Cloudflare Pages, Vercel, Lovable). Targets that
			block automated review will not produce complete readiness evidence.
		</p>
	</section>
{/if}
