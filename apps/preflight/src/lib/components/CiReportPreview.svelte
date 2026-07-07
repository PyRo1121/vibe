<script lang="ts">
	type Finding = {
		label: string;
		status: 'blocker' | 'warn' | 'pass';
		message: string;
	};

	let {
		compact = false
	}: {
		compact?: boolean;
	} = $props();

	const findings: Finding[] = [
		{
			label: 'Workflow permissions',
			status: 'blocker',
			message: 'write-all token permissions on a deploy workflow'
		},
		{
			label: 'Quality gates',
			status: 'warn',
			message: 'build runs, but typecheck is missing before deploy'
		},
		{
			label: 'Action refs',
			status: 'warn',
			message: 'third-party deploy action uses a floating main ref'
		},
		{
			label: 'Repo hygiene',
			status: 'pass',
			message: 'lockfile and Node runtime pin detected'
		}
	];

	const statusClass: Record<Finding['status'], string> = {
		blocker: 'bg-red-500/10 text-red-300',
		warn: 'bg-amber-500/10 text-amber-300',
		pass: 'bg-emerald-500/10 text-emerald-300'
	};
</script>

<section
	class="rounded-xl border border-sky-500/30 bg-sky-950/10 p-5"
	aria-label="Sample Deploylint CI report"
>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">Sample PR report</p>
			<h2 class="mt-2 text-xl font-semibold text-white">Deploy risk before merge</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				The first run is advisory: it tells the builder what would block deploy without failing the
				pull request.
			</p>
		</div>
		<div class="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-right">
			<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Gate status</p>
			<p class="mt-1 text-lg font-bold text-amber-300">Advisory</p>
		</div>
	</div>

	<div class="mt-5 grid gap-3 sm:grid-cols-3">
		<div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
			<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Score</p>
			<p class="mt-1 text-2xl font-bold text-amber-300">72</p>
		</div>
		<div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
			<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Blockers</p>
			<p class="mt-1 text-2xl font-bold text-red-300">1</p>
		</div>
		<div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
			<p class="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Mode</p>
			<p class="mt-1 text-2xl font-bold text-sky-300">PR</p>
		</div>
	</div>

	<div class="mt-5 space-y-2">
		{#each compact ? findings.slice(0, 3) : findings as finding (finding.label)}
			<div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="text-sm font-semibold text-white">{finding.label}</p>
					<span
						class="rounded px-2 py-1 text-[10px] font-bold uppercase {statusClass[finding.status]}"
					>
						{finding.status}
					</span>
				</div>
				<p class="mt-1 text-sm leading-5 text-zinc-400">{finding.message}</p>
			</div>
		{/each}
	</div>

	<p class="mt-4 text-xs leading-5 text-zinc-500">
		Once this report is clean for a few PRs, switch the same workflow to gate mode and let it fail
		risky deploys.
	</p>
</section>
