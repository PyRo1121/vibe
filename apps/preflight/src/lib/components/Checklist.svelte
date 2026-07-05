<script lang="ts">
	import type { ScanCheck, ScanReport } from '$lib/scan/types';
	import { buildUnlockOffer } from '$lib/client/preflight-session';
	import { getCheckCatalogEntry } from '$lib/scan/catalog';
	import { sortChecksByPriority } from '$lib/scan/verdict';
	import { categoryLabels, priorityClass, statusClass, statusIcon } from '$lib/ui/scan-styles';

	let {
		report,
		copiedId,
		onCopyPrompt
	}: {
		report: ScanReport;
		copiedId: string | null;
		onCopyPrompt: (id: string, text: string) => void;
	} = $props();

	const offer = $derived(buildUnlockOffer(report));
	const issues = $derived(sortChecksByPriority(report.checks));
	const passing = $derived(report.checks.filter((c) => c.status === 'pass'));

	let showPassing = $state(false);

	const PRIORITY_HEADINGS: Record<string, { label: string; sub: string }> = {
		p0: { label: 'Launch blockers', sub: 'Fix these before sharing anywhere public' },
		p1: { label: 'Important issues', sub: 'Fix before Product Hunt, Reddit, or paid traffic' },
		p2: { label: 'Polish', sub: 'Worth fixing — not launch-blocking' }
	};

	function groupIssues(items: ScanCheck[]): Array<{ priority: string; items: ScanCheck[] }> {
		const groups: Array<{ priority: string; items: ScanCheck[] }> = [];
		for (const item of items) {
			const priority = item.priority ?? 'p2';
			const last = groups[groups.length - 1];
			if (last && last.priority === priority) last.items.push(item);
			else groups.push({ priority, items: [item] });
		}
		return groups;
	}

	const issueGroups = $derived(groupIssues(issues));
</script>

<section class="mb-10">
	<div class="mb-5 flex flex-wrap items-end justify-between gap-2">
		<div>
			<h2 class="text-xl font-semibold text-white">Findings</h2>
			<p class="mt-1 text-sm text-zinc-500">
				{report.checks.length} checks — {issues.length}
				{issues.length === 1 ? 'issue' : 'issues'}, {passing.length} passing
			</p>
		</div>
		{#if !report.unlocked && offer && offer.lockedPromptCount > 0}
			<p class="text-sm font-medium text-sky-400">
				{offer.lockedPromptCount} fix prompts locked · 1 free below
			</p>
		{/if}
	</div>

	{#if issues.length === 0}
		<div class="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
			<p class="font-medium text-emerald-300">Every check passed.</p>
			<p class="mt-1 text-sm text-zinc-400">
				Re-scan after any last-minute changes before you post.
			</p>
		</div>
	{/if}

	{#each issueGroups as group (group.priority)}
		<div class="mb-6">
			<div class="mb-3 flex items-baseline gap-3">
				<span
					class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase {priorityClass(
						group.priority
					)}"
				>
					{group.priority}
				</span>
				<h3 class="font-semibold text-white">
					{PRIORITY_HEADINGS[group.priority]?.label ?? 'Issues'}
					<span class="ml-1 text-sm font-normal text-zinc-500">({group.items.length})</span>
				</h3>
				<p class="hidden text-xs text-zinc-600 sm:block">
					{PRIORITY_HEADINGS[group.priority]?.sub ?? ''}
				</p>
			</div>
			<div class="space-y-3">
				{#each group.items as item (item.id)}
					{@const catalog = getCheckCatalogEntry(item.id)}
					<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
						<div class="flex items-start gap-3">
							<span
								class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold {statusClass(
									item.status
								)}"
							>
								{statusIcon(item.status)}
							</span>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="font-medium text-white">{item.title}</span>
									<span
										class="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400"
									>
										{categoryLabels[item.category] ?? item.category}
									</span>
								</div>
								<p class="mt-1 text-sm text-zinc-400">{item.message}</p>
								{#if catalog}
									<div
										class="mt-3 grid gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3 text-xs text-zinc-400 sm:grid-cols-2"
									>
										<div>
											<p class="font-semibold tracking-wide text-zinc-300 uppercase">
												Why this matters
											</p>
											<p class="mt-1 leading-relaxed">{catalog.why}</p>
										</div>
										<div>
											<p class="font-semibold tracking-wide text-zinc-300 uppercase">Detection</p>
											<p class="mt-1 leading-relaxed">{catalog.detectedBy}</p>
											{#if catalog.falsePositive}
												<p class="mt-2 leading-relaxed text-zinc-500">
													<span class="font-medium text-zinc-400">Might be okay if:</span>
													{catalog.falsePositive}
												</p>
											{/if}
										</div>
									</div>
								{/if}
								{#if report.unlocked && item.fixPrompt}
									<div class="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
										<p class="mb-2 text-xs whitespace-pre-wrap text-zinc-300">{item.fixPrompt}</p>
										<button
											type="button"
											class="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
											onclick={() => onCopyPrompt(item.id, item.fixPrompt)}
										>
											{copiedId === item.id ? 'Copied!' : 'Copy prompt'}
										</button>
									</div>
								{:else if !report.unlocked && item.id === report.samplePromptId && item.fixPrompt}
									<div class="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
										<p class="mb-2 text-[10px] font-semibold tracking-wider text-sky-400 uppercase">
											Sample fix prompt (free)
										</p>
										<p class="mb-2 text-xs whitespace-pre-wrap text-zinc-300">{item.fixPrompt}</p>
										<button
											type="button"
											class="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700"
											onclick={() => onCopyPrompt(item.id, item.fixPrompt)}
										>
											{copiedId === item.id ? 'Copied!' : 'Copy sample'}
										</button>
									</div>
								{:else}
									<div
										class="relative mt-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-3"
									>
										<p class="blur-sm select-none text-xs text-zinc-500">
											Cursor-ready fix prompt for {item.title.toLowerCase()}…
										</p>
										<div
											class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-zinc-950/85 px-3 text-center"
										>
											<p class="text-xs font-medium text-sky-300">Unlock to copy this fix</p>
											<p class="text-[10px] text-zinc-500">Included in $9 fix & verify</p>
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/each}

	{#if passing.length > 0}
		<div class="rounded-xl border border-zinc-800/70 bg-zinc-900/20">
			<button
				type="button"
				class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
				aria-expanded={showPassing}
				onclick={() => (showPassing = !showPassing)}
			>
				<span class="text-sm font-medium text-zinc-300">
					<span class="mr-2 text-emerald-400">✓</span>{passing.length} passing checks
				</span>
				<span class="text-xs text-zinc-500">{showPassing ? 'Hide' : 'Show'}</span>
			</button>
			{#if showPassing}
				<ul class="border-t border-zinc-800/70 px-4 py-2">
					{#each passing as item (item.id)}
						<li
							class="flex items-baseline gap-3 border-b border-zinc-800/40 py-2 text-sm last:border-b-0"
						>
							<span class="shrink-0 text-emerald-400">✓</span>
							<span class="shrink-0 font-medium text-zinc-300">{item.title}</span>
							<span class="min-w-0 truncate text-xs text-zinc-500">{item.message}</span>
							<span
								class="ml-auto shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-500"
							>
								{categoryLabels[item.category] ?? item.category}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</section>
