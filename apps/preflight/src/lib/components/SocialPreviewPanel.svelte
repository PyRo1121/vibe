<script lang="ts">
	import type { ScanReport } from '$lib/scan/types';

	let { report }: { report: ScanReport } = $props();
</script>

{#if report.socialPreview}
	<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
		<h2 class="mb-4 text-xl font-semibold text-white">Social preview</h2>
		<p class="mb-4 text-sm text-zinc-400">
			How your link looks when pasted on X or Slack — we verify meta tags <em>and</em> that og:image returns
			a real image, not an HTML fallback from your SPA router.
		</p>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
				<div class="border-b border-zinc-800 px-3 py-2 text-xs text-zinc-500">X / Twitter card</div>
				<div class="p-4">
					{#if report.socialPreview.imageUrl && report.socialPreview.imageReachable === false}
						<p class="mb-2 text-xs font-medium text-red-400">
							Preview image URL failed to load — fix before gate mode
						</p>
					{/if}
					{#if report.socialPreview.imageUrl}
						<img
							src={report.socialPreview.imageUrl}
							alt=""
							class="mb-3 aspect-[1.91/1] w-full rounded-lg bg-zinc-800 object-cover"
							loading="lazy"
							referrerpolicy="no-referrer"
						/>
					{:else}
						<div
							class="mb-3 flex aspect-[1.91/1] items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500"
						>
							No og:image
						</div>
					{/if}
					<p class="truncate text-sm font-medium text-white">
						{report.socialPreview.title ?? 'Missing title'}
					</p>
					<p class="mt-1 line-clamp-2 text-xs text-zinc-400">
						{report.socialPreview.description ?? 'Missing description'}
					</p>
					<p class="mt-2 truncate text-xs text-zinc-600">{report.finalUrl}</p>
				</div>
			</div>
			<div class="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
				<div class="border-b border-zinc-800 px-3 py-2 text-xs text-zinc-500">Slack unfurl</div>
				<div class="border-l-4 border-sky-500 p-4">
					<p class="text-xs font-semibold text-sky-400 uppercase">Link preview</p>
					<p class="mt-1 font-medium text-white">
						{report.socialPreview.title ?? 'Missing title'}
					</p>
					<p class="mt-1 text-sm text-zinc-400">
						{report.socialPreview.description ?? 'Missing description'}
					</p>
				</div>
			</div>
		</div>
		{#if report.socialPreview.issues.length > 0}
			<ul class="mt-4 space-y-1 text-sm text-amber-300">
				{#each report.socialPreview.issues as issue (issue)}
					<li>• {issue}</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-4 text-sm text-emerald-400">Social preview tags look complete.</p>
		{/if}
	</section>
{/if}
