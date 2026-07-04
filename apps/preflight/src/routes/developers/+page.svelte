<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));

	const hostedGateYaml = $derived(`name: Preflight deploy gate

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Block deploy if launch blockers remain
        env:
          PREFLIGHT_URL: \${{ secrets.PREFLIGHT_GATE_URL }}
          PREFLIGHT_API: ${base}
          PREFLIGHT_MIN_SCORE: '80'
          # PREFLIGHT_MODE: advisory   # report only, never blocks
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}   # enables the PR comment
        run: |
          curl -fsSL ${base}/gate-remote.mjs -o gate-remote.mjs
          node gate-remote.mjs "$PREFLIGHT_URL"`);

	const localGate = $derived(`npm run gate -w preflight -- https://your-app.com

# Or with env vars:
PREFLIGHT_URL=https://your-app.com PREFLIGHT_MIN_SCORE=80 npm run gate -w preflight`);

	const hostedScript = $derived(`curl -fsSL ${base}/gate-remote.mjs -o gate-remote.mjs
node gate-remote.mjs https://your-app.com`);
</script>

<svelte:head>
	<title>Developers — Preflight CI gate</title>
	<meta
		name="description"
		content="Block bad deploys with Preflight: GitHub Action, zero-install gate script, local CLI, and MCP tools."
	/>
	<link rel="canonical" href="{base}/developers" />
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-12 text-zinc-300">
	<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">Fix and prove in CI</p>
	<h1 class="mb-4 text-3xl font-bold text-white sm:text-4xl">Deploy gate for vibe-coded apps</h1>
	<p class="mb-8 text-lg text-zinc-400">
		Scan in the browser, fix with Cursor prompts, re-scan for delta — then
		<strong class="font-medium text-zinc-200">block merges</strong> when GO/NO-GO blockers remain. Not
		Lighthouse. Same launch judgment you already trust.
	</p>

	<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
		<h2 class="mb-2 text-xl font-semibold text-white">What fails the gate</h2>
		<ul class="list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li><strong class="text-zinc-300">NO-GO</strong> verdict (P0 launch blockers)</li>
			<li>
				Score below <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300"
					>PREFLIGHT_MIN_SCORE</code
				> (default 80)
			</li>
			<li>
				Any P0 check failure — exposed secrets, missing privacy page, HTTPS, noindex, robots
				blocking Google, etc.
			</li>
		</ul>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">1. GitHub Action (recommended)</h2>
		<p class="mb-4 text-sm text-zinc-500">
			Add repository secret <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300"
				>PREFLIGHT_GATE_URL</code
			>
			with your production URL (e.g.
			<code class="rounded bg-zinc-800 px-1.5 py-0.5">https://your-app.com</code>).
		</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{hostedGateYaml}</code
			></pre>
		<ul class="mt-4 list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				<strong class="text-zinc-300">PR comments</strong> — on pull requests the gate posts (and
				updates) a comment with the verdict, score, failing checks, and a link to the full report.
				Just pass <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">GITHUB_TOKEN</code>.
			</li>
			<li>
				<strong class="text-zinc-300">Job summary</strong> — the same markdown lands in the Actions run
				summary automatically.
			</li>
			<li>
				<strong class="text-zinc-300">Advisory mode</strong> — set
				<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">PREFLIGHT_MODE: advisory</code>
				to report without ever failing the build. Good for the first weeks on an existing project.
			</li>
		</ul>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">2. Zero-install script</h2>
		<p class="mb-4 text-sm text-zinc-500">
			Fetch the hosted gate from <a class="text-sky-400 hover:underline" href="/gate-remote.mjs"
				>/gate-remote.mjs</a
			> — no monorepo required.
		</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{hostedScript}</code
			></pre>
		<p class="mt-3 text-sm text-zinc-500">
			Exit code <strong class="text-zinc-400">0</strong> = pass ·
			<strong class="text-zinc-400">1</strong>
			= fail ·
			<strong class="text-zinc-400">2</strong> = usage/API error
		</p>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">3. Monorepo CLI</h2>
		<p class="mb-4 text-sm text-zinc-500">If you fork or clone the Preflight repo:</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{localGate}</code
			></pre>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">4. Cursor MCP</h2>
		<p class="mb-4 text-sm text-zinc-500">
			Add <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">preflight-mcp</code> to
			<code class="rounded bg-zinc-800 px-1.5 py-0.5">.cursor/mcp.json</code> for agent tools:
		</p>
		<ul class="list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li><code class="text-sky-300">preflight_scan</code> — full audit summary</li>
			<li><code class="text-sky-300">preflight_gate</code> — PASS/FAIL for launch readiness</li>
		</ul>
	</section>

	<section class="mb-10 rounded-2xl border border-sky-900/40 bg-sky-950/20 p-6">
		<h2 class="mb-2 text-lg font-semibold text-white">The full loop</h2>
		<ol class="list-decimal space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				Scan free at <a class="text-sky-400 hover:underline" href="/">preflight.latham.cloud</a>
			</li>
			<li>Unlock fix prompts ($9) → paste into Cursor</li>
			<li>Re-scan to prove score delta</li>
			<li>Wire this gate into CI so regressions never ship</li>
		</ol>
	</section>

	<p>
		<a class="text-sky-400 hover:underline" href="/">← Back to scan</a>
	</p>
</div>
