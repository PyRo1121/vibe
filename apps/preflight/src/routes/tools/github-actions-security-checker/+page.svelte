<script lang="ts">
	import { resolve } from '$app/paths';
	import { analyzeGithubActionsYaml, SAMPLE_GITHUB_ACTIONS_WORKFLOW } from '$lib/ci/github-actions';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const maxWorkflowYamlLength = 80_000;
	let yaml = $state(SAMPLE_GITHUB_ACTIONS_WORKFLOW);
	let copied = $state<string | null>(null);

	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const title = buildSeoTitle('GitHub Actions security checker');
	const description =
		'Paste GitHub Actions workflow YAML and find risky permissions, pull_request_target usage, floating action refs, and missing quality gates.';
	const canonical = $derived(`${base}/tools/github-actions-security-checker`);
	const jsonLd = $derived([
		buildPageJsonLd({ base, canonical, title, description, type: 'SoftwareApplication' })
	]);
	const result = $derived(analyzeGithubActionsYaml(yaml));
	const advisoryWorkflow = $derived(`name: Deploylint advisory report

on:
  pull_request:
  workflow_dispatch:

permissions: {}

jobs:
  deploylint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Run Deploylint advisory report
        env:
          DEPLOYLINT_URL: \${{ secrets.DEPLOYLINT_URL }}
          DEPLOYLINT_API: ${base}
          DEPLOYLINT_MODE: advisory
          DEPLOYLINT_MIN_SCORE: '80'
        run: |
          if [ -z "$DEPLOYLINT_URL" ]; then
            echo "Skipping Deploylint advisory report because DEPLOYLINT_URL is unavailable (forked pull request secrets are not exposed)."
            exit 0
          fi
          curl -fsSL ${base}/gate-remote.mjs -o gate-remote.mjs
          node gate-remote.mjs "$DEPLOYLINT_URL"`);

	function statusClass(status: string): string {
		if (status === 'pass') return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300';
		if (status === 'fail') return 'border-red-500/20 bg-red-500/5 text-red-300';
		return 'border-amber-500/20 bg-amber-500/5 text-amber-300';
	}

	function verdictClass(verdict: string): string {
		if (verdict === 'hardened') return 'text-emerald-300';
		if (verdict === 'risky') return 'text-red-300';
		return 'text-amber-300';
	}

	async function copyText(id: string, text: string) {
		await navigator.clipboard.writeText(text);
		copied = id;
		setTimeout(() => {
			if (copied === id) copied = null;
		}, 1800);
	}
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-6xl px-4 py-12">
	<section class="mb-8">
		<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
			GitHub Actions Security Checker
		</p>
		<h1 class="max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
			Check workflow YAML before it deploys risky code.
		</h1>
		<p class="mt-4 max-w-3xl text-lg leading-8 text-zinc-400">
			Paste a GitHub Actions workflow. Deploylint checks token permissions,
			<code class="rounded bg-zinc-900 px-1.5 py-0.5 text-sky-300">pull_request_target</code>
			usage, floating third-party action refs, and whether CI actually runs lint, typecheck, tests, and
			build.
		</p>
		<p class="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
			Automated heuristic check. It does not execute workflows, inspect repository settings, or
			prove a workflow is secure.
		</p>
	</section>

	<div class="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
		<section class="min-w-0">
			<div class="mb-3 flex items-center justify-between gap-3">
				<label for="workflow-yaml" class="text-sm font-semibold text-white">Workflow YAML</label>
				<button
					type="button"
					class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
					onclick={() => (yaml = SAMPLE_GITHUB_ACTIONS_WORKFLOW)}
				>
					Load risky sample
				</button>
			</div>
			<textarea
				id="workflow-yaml"
				bind:value={yaml}
				maxlength={maxWorkflowYamlLength}
				spellcheck="false"
				class="min-h-[520px] w-full min-w-0 resize-y rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm leading-6 text-zinc-200 outline-none focus:border-sky-500"
			></textarea>
			<p class="mt-2 text-xs text-zinc-500">
				Checks up to {maxWorkflowYamlLength.toLocaleString()} characters. Large repos should use the repo
				scan or CI gate.
			</p>
		</section>

		<aside class="min-w-0 space-y-4">
			<section class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Hardening score</p>
				<div class="mt-2 flex items-end justify-between gap-4">
					<div>
						<p class="text-5xl font-bold tabular-nums {verdictClass(result.verdict)}">
							{result.score}
						</p>
						<p class="text-sm text-zinc-500">/100</p>
					</div>
					<p
						class="mb-2 rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold {verdictClass(
							result.verdict
						)}"
					>
						{result.verdictLabel}
					</p>
				</div>
				<div class="mt-4 flex gap-2 text-xs">
					<span class="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300">
						{result.pass} pass
					</span>
					<span class="rounded bg-amber-500/10 px-2 py-1 text-amber-300">
						{result.warn} warn
					</span>
					<span class="rounded bg-red-500/10 px-2 py-1 text-red-300">
						{result.fail} fail
					</span>
				</div>
				<p class="mt-4 text-sm leading-6 text-zinc-400">{result.nextAction}</p>
			</section>

			<section class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="font-semibold text-white">Agent repair prompt</h2>
					<button
						type="button"
						class="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20"
						onclick={() => copyText('prompt', result.repairPrompt)}
					>
						{copied === 'prompt' ? 'Copied' : 'Copy'}
					</button>
				</div>
				<pre
					class="max-h-52 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs leading-5 whitespace-pre-wrap text-zinc-300"><code
						>{result.repairPrompt}</code
					></pre>
			</section>

			<section class="rounded-xl border border-sky-500/30 bg-sky-500/5 p-5">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="font-semibold text-white">Least-privilege starter workflow</h2>
					<button
						type="button"
						class="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20"
						onclick={() => copyText('workflow', result.hardenedWorkflow)}
					>
						{copied === 'workflow' ? 'Copied' : 'Copy'}
					</button>
				</div>
				<p class="mb-3 text-sm leading-6 text-zinc-400">
					Paste this as <code class="rounded bg-zinc-950 px-1.5 py-0.5 text-sky-300"
						>.github/workflows/ci.yml</code
					>, then require it before deploy jobs run.
				</p>
				<pre
					class="max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs leading-5 whitespace-pre-wrap text-zinc-300"><code
						>{result.hardenedWorkflow}</code
					></pre>
			</section>

			<section class="rounded-xl border border-sky-500/30 bg-sky-500/5 p-5">
				<div class="mb-3 flex items-center justify-between gap-3">
					<h2 class="font-semibold text-white">Next: advisory CI report</h2>
					<button
						type="button"
						class="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20"
						onclick={() => copyText('advisory', advisoryWorkflow)}
					>
						{copied === 'advisory' ? 'Copied' : 'Copy'}
					</button>
				</div>
				<p class="mb-3 text-sm leading-6 text-zinc-400">
					Add this after the workflow is clean. It writes an Actions job summary and does not block
					builds. Set the
					<code class="rounded bg-zinc-950 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_URL</code>
					secret to your staging or production URL.
				</p>
				<p class="mb-3 text-xs leading-5 text-zinc-500">
					This zero-install workflow runs Deploylint's hosted script in CI. Vendor the script or
					composite action if your supply-chain policy requires reviewed, pinned code.
				</p>
				<pre
					class="max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs leading-5 whitespace-pre-wrap text-zinc-300"><code
						>{advisoryWorkflow}</code
					></pre>
			</section>

			<section class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
				<h2 class="mb-3 font-semibold text-white">Findings</h2>
				<div class="space-y-3">
					{#each result.findings as finding (finding.id)}
						<article class="rounded-lg border p-3 {statusClass(finding.status)}">
							<div class="mb-1 flex items-center justify-between gap-3">
								<h3 class="text-sm font-semibold text-white">{finding.shortTitle}</h3>
								<span class="text-[10px] font-bold tracking-wider uppercase">
									{finding.status}
								</span>
							</div>
							<p class="text-xs leading-5 text-zinc-300">{finding.message}</p>
							<p class="mt-2 text-xs leading-5 text-zinc-400">{finding.fix}</p>
							{#if finding.status !== 'pass'}
								<pre
									class="mt-2 overflow-x-auto rounded bg-zinc-950/80 p-2 text-[11px] leading-5 text-zinc-300"><code
										>{finding.snippet}</code
									></pre>
							{/if}
						</article>
					{/each}
				</div>
			</section>
		</aside>
	</div>

	<section class="mt-10 grid gap-4 md:grid-cols-3">
		<a
			href={resolve('/developers')}
			class="rounded-xl border border-sky-500/40 bg-sky-500/5 p-5 hover:border-sky-400"
		>
			<p class="font-semibold text-white">Install in GitHub Actions</p>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Turn this check into a non-blocking PR report, then switch to a deploy gate.
			</p>
		</a>
		<a
			href={resolve('/app#project')}
			class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-sky-500/70"
		>
			<p class="font-semibold text-white">Audit a deploy target</p>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Check the live URL or public repo after the workflow path is under control.
			</p>
		</a>
		<a
			href={resolve('/tools')}
			class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-sky-500/70"
		>
			<p class="font-semibold text-white">See all tools</p>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Follow the broader builder DevOps toolbox as it grows.
			</p>
		</a>
	</section>
</div>
