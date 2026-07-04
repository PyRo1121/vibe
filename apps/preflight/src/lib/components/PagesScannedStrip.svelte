<script lang="ts">
	import type { ScanReport, ScannedPage } from '$lib/scan/types';

	let { report }: { report: ScanReport } = $props();

	const pages = $derived(report.pagesScanned ?? []);

	const ROLE_LABELS: Record<ScannedPage['role'], string> = {
		home: 'Home',
		privacy: 'Privacy',
		terms: 'Terms',
		pricing: 'Pricing',
		sitemap: 'Page'
	};

	function displayLabel(page: ScannedPage): string {
		if (page.role === 'sitemap') {
			const path = pathOf(page.url);
			return path === '/' ? ROLE_LABELS.sitemap : path;
		}
		return ROLE_LABELS[page.role];
	}

	function pathOf(url: string): string {
		try {
			return new URL(url).pathname || '/';
		} catch {
			return url;
		}
	}

	function statusLabel(page: ScannedPage): string {
		if (page.status === null) return 'unreachable';
		return `HTTP ${page.status}`;
	}

	function statusOk(page: ScannedPage): boolean {
		return page.status !== null && page.status >= 200 && page.status < 400;
	}
</script>

{#if pages.length > 1}
	<div
		class="mb-6 flex flex-wrap items-center gap-2 text-xs text-zinc-500"
		role="status"
		aria-label="Pages scanned"
	>
		<span class="font-medium text-zinc-400">Scanned {pages.length} pages:</span>
		{#each pages as page (page.url)}
			<span
				class="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1"
				title="{page.url} — {statusLabel(page)}"
			>
				<span
					class="h-1.5 w-1.5 rounded-full {statusOk(page) ? 'bg-emerald-400' : 'bg-red-400'}"
					aria-hidden="true"
				></span>
				<span class="text-zinc-300">{displayLabel(page)}</span>
				<span class="text-zinc-600">{pathOf(page.url)}</span>
			</span>
		{/each}
	</div>
{/if}
