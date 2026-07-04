<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';

	let { report }: { report: ScanReport } = $props();

	const showGuide = $derived(
		report.unlocked && report.scoreDelta == null && report.checks.some((c) => c.status !== 'pass')
	);
</script>

{#if showGuide}
	<section class="mb-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
		<p class="text-xs font-semibold tracking-widest text-emerald-400 uppercase">Your unlock — fix & prove it</p>
		<h2 class="mt-2 text-lg font-semibold text-white">Three steps before you post publicly</h2>
		<ol class="mt-4 space-y-3 text-sm text-zinc-300">
			<li class="flex gap-3">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300"
					>1</span
				>
				<span>Copy the <strong class="text-white">master repair prompt</strong> below into Cursor or Claude.</span>
			</li>
			<li class="flex gap-3">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300"
					>2</span
				>
				<span>Apply the fixes and redeploy your site.</span>
			</li>
			<li class="flex gap-3">
				<span
					class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300"
					>3</span
				>
				<span
					>Hit <strong class="text-white">Re-scan to verify</strong> — we'll show your score delta so you can
					post with proof.</span
				>
			</li>
		</ol>
	</section>
{/if}
