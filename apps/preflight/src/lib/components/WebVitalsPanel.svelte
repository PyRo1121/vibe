<script lang="ts">
	import {
		parsePsiResult,
		psiUrl,
		type PsiResponse,
		type VitalRating,
		type WebVitalsResult
	} from '$lib/client/web-vitals';
	import type { ScanReport } from '$lib/scan/types';

	let { report }: { report: ScanReport } = $props();

	let vitals = $state<WebVitalsResult | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const eligible = $derived(report.scanCoverage !== 'blocked' && !report.repo);

	async function measure() {
		loading = true;
		error = null;
		try {
			const res = await fetch(psiUrl(report.finalUrl));
			if (res.status === 429) {
				throw new Error('Google rate limit hit — wait a minute and try again.');
			}
			if (!res.ok) {
				throw new Error(`PageSpeed API error (${res.status}) — try again shortly.`);
			}
			vitals = parsePsiResult((await res.json()) as PsiResponse);
			if (vitals.metrics.length === 0 && vitals.performanceScore == null) {
				vitals = null;
				throw new Error('Google could not analyze this page.');
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Measurement failed';
		} finally {
			loading = false;
		}
	}

	function ratingClass(rating: VitalRating): string {
		if (rating === 'good') return 'text-emerald-400';
		if (rating === 'needs-improvement') return 'text-amber-400';
		return 'text-red-400';
	}

	function scoreClass(score: number): string {
		if (score >= 90) return 'text-emerald-400';
		if (score >= 50) return 'text-amber-400';
		return 'text-red-400';
	}
</script>

{#if eligible}
	<section class="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 class="font-semibold text-white">Core Web Vitals</h2>
				<p class="mt-0.5 text-xs text-zinc-500">
					Measured by Google PageSpeed (mobile) — real-user data where available
				</p>
			</div>
			{#if !vitals}
				<button
					type="button"
					disabled={loading}
					class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
					onclick={measure}
				>
					{loading ? 'Measuring… ~30s' : 'Measure now'}
				</button>
			{/if}
		</div>

		{#if error}
			<p class="mt-3 text-sm text-amber-400" role="alert">{error}</p>
		{/if}

		{#if vitals}
			<div class="mt-4 flex flex-wrap items-stretch gap-3">
				{#if vitals.performanceScore != null}
					<div class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
						<p class="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
							Performance
						</p>
						<p class="text-2xl font-bold tabular-nums {scoreClass(vitals.performanceScore)}">
							{vitals.performanceScore}
						</p>
					</div>
				{/if}
				{#each vitals.metrics as metric (metric.id)}
					<div class="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
						<p class="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
							{metric.label}
						</p>
						<p class="text-2xl font-bold tabular-nums {ratingClass(metric.rating)}">
							{metric.display}
						</p>
						<p class="text-[10px] text-zinc-600">{metric.field ? 'real users' : 'lab test'}</p>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{/if}
