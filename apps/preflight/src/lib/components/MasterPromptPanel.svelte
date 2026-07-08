<script lang="ts">
	let {
		masterPrompt,
		copied,
		onCopy
	}: {
		masterPrompt: string;
		copied: boolean;
		onCopy: () => void;
	} = $props();
</script>

<section class="mb-10 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-6">
	<h2 class="mb-2 text-lg font-semibold text-white">Apply the repair plan</h2>
	<p class="mb-3 text-sm text-zinc-400">
		Use this repair plan in your editor or agent — it fixes blockers first, then polish. Run
		verification when done.
	</p>
	<div class="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
		<p class="mb-3 text-xs whitespace-pre-wrap text-zinc-300">{masterPrompt}</p>
		<button
			type="button"
			class="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
			onclick={onCopy}
		>
			{copied ? 'Copied!' : 'Copy repair plan'}
		</button>
	</div>
</section>
