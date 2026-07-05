<script lang="ts">
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const title = buildSeoTitle('Deploylint CI gate for GitHub Actions, CLI, and MCP');
	const description =
		'Block bad deploys with Deploylint CI gates for GitHub Actions, zero-install scripts, local CLI checks, and MCP tools for coding agents.';
	const canonical = $derived(`${base}/developers`);
	const jsonLd = $derived([
		{
			...buildPageJsonLd({ base, canonical, title, description, type: 'TechArticle' }),
			headline: title,
			about: 'Deploylint CI gates and MCP tools'
		},
		{
			'@context': 'https://schema.org',
			'@type': 'HowTo',
			name: 'Add a Deploylint CI gate',
			description,
			inLanguage: 'en-US',
			isPartOf: {
				'@id': `${base}/#website`
			},
			step: [
				{ '@type': 'HowToStep', name: 'Set DEPLOYLINT_GATE_URL to your production URL' },
				{ '@type': 'HowToStep', name: 'Run Deploylint from GitHub Actions or the CLI' },
				{ '@type': 'HowToStep', name: 'Block deploys when launch blockers remain' }
			]
		}
	]);

	const compositeActionYaml = $derived(`name: Deploylint deploy gate

on:
  pull_request:
  push:
    branches: [main]

jobs:
  deploylint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Copy .github/actions/deploylint-gate from github.com/PyRo1121/vibe
      # Or use the curl script below — same gate rules.
      - uses: ./.github/actions/deploylint-gate
        with:
          url: \${{ secrets.DEPLOYLINT_GATE_URL }}
          api: ${base}
          min_score: '80'
          mode: gate`);

	const hostedGateYaml = $derived(`name: Deploylint deploy gate (zero-install)

on:
  pull_request:
  push:
    branches: [main]

jobs:
  deploylint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Block deploy if launch blockers remain
        env:
          PREFLIGHT_URL: \${{ secrets.DEPLOYLINT_GATE_URL }}
          PREFLIGHT_API: ${base}
          PREFLIGHT_MIN_SCORE: '80'
          # PREFLIGHT_MODE: advisory   # report only, never blocks
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          curl -fsSL ${base}/gate-remote.mjs -o gate-remote.mjs
          node gate-remote.mjs "$PREFLIGHT_URL"`);

	const mcpJson = $derived(`{
  "mcpServers": {
    "deploylint": {
      "command": "npx",
      "args": ["tsx", "apps/preflight-mcp/src/index.ts"],
      "env": {
        "DEPLOYLINT_API": "${base}"
      }
    }
  }
}`);

	const localGate = $derived(`npm run gate -w preflight -- https://your-app.com

# Or with env vars:
PREFLIGHT_URL=https://your-app.com PREFLIGHT_MIN_SCORE=80 npm run gate -w preflight`);

	const hostedScript = $derived(`curl -fsSL ${base}/gate-remote.mjs -o gate-remote.mjs
node gate-remote.mjs https://your-app.com`);
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

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
		<h2 class="mb-2 text-xl font-semibold text-white">1. Composite GitHub Action</h2>
		<p class="mb-4 text-sm text-zinc-500">
			Copy <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300"
				>.github/actions/deploylint-gate</code
			>
			from the
			<a
				class="text-sky-400 hover:underline"
				href="https://github.com/PyRo1121/vibe/tree/main/.github/actions/deploylint-gate"
				>vibe monorepo</a
			>
			(or vendor the folder). Set secret
			<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_GATE_URL</code>
			to your production URL.
		</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{compositeActionYaml}</code
			></pre>
		<ul class="mt-4 list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				<code class="text-sky-300">mode: advisory</code> — report issues without failing the build
			</li>
			<li>
				<code class="text-sky-300">min_score</code> — default 80; lower for early-stage apps
			</li>
		</ul>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">2. Zero-install workflow (curl)</h2>
		<p class="mb-4 text-sm text-zinc-500">
			No action folder — fetch <a class="text-sky-400 hover:underline" href="/gate-remote.mjs"
				>/gate-remote.mjs</a
			>
			at runtime. PR comments need
			<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">GITHUB_TOKEN</code>.
		</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{hostedGateYaml}</code
			></pre>
		<ul class="mt-4 list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				<strong class="text-zinc-300">PR comments</strong> — verdict, score, failing checks, report link
			</li>
			<li>
				<strong class="text-zinc-300">Job summary</strong> — same markdown in the Actions run summary
			</li>
			<li>
				<code class="text-sky-300">node gate-remote.mjs URL --json</code> — structured output for custom
				steps
			</li>
		</ul>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">3. Zero-install script (local / CI)</h2>
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
		<h2 class="mb-2 text-xl font-semibold text-white">4. Monorepo CLI</h2>
		<p class="mb-4 text-sm text-zinc-500">If you fork or clone the Deploylint repo:</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{localGate}</code
			></pre>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">5. Cursor MCP + agent skill</h2>
		<p class="mb-4 text-sm text-zinc-500">
			Add to <code class="rounded bg-zinc-800 px-1.5 py-0.5">.cursor/mcp.json</code> at your repo
			root (clone vibe or copy <code class="text-sky-300">apps/preflight-mcp</code>):
		</p>
		<pre
			class="mb-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{mcpJson}</code
			></pre>
		<ul class="list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				<code class="text-sky-300">deploylint_scan</code> — score, embarrassment risks, issues, fix
				prompts (<code class="text-sky-300">format: json</code> for agents)
			</li>
			<li>
				<code class="text-sky-300">deploylint_gate</code> — PASS/FAIL;
				<code class="text-sky-300">advisory: true</code> for non-blocking reports
			</li>
			<li>
				<code class="text-sky-300">unlock_session_id</code> — after subscription checkout, pass
				Stripe
				<code class="text-sky-300">cs_live_…</code> for all prompts + master paste
			</li>
			<li>
				Legacy <code class="text-sky-300">preflight_scan</code> /
				<code class="text-sky-300">preflight_gate</code> aliases still work
			</li>
		</ul>
		<p class="mt-4 text-sm text-zinc-500">
			Agent skill for skills.sh:
			<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">skills/deploylint/SKILL.md</code>
			in the repo — copy into your agent skills folder.
		</p>
		<p class="mt-2 text-sm text-zinc-500">
			API base: <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_API</code>
			(default <code class="text-sky-300">{base}</code>)
		</p>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">6. README score badge</h2>
		<p class="mb-4 text-sm text-zinc-500">
			After a scan, copy the badge from the report summary — embed proof in your repo README (like
			CI shields, but launch-readiness):
		</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{`[![Deploylint score](${base}/r/YOUR_REPORT_ID/badge.svg)](${base}/r/YOUR_REPORT_ID)`}</code
			></pre>
		<p class="mt-3 text-sm text-zinc-500">
			Shared reports include an OG image at <code class="text-sky-300">/r/[id]/badge.svg</code> for Slack,
			X, and GitHub link previews.
		</p>
	</section>

	<section class="mb-10 rounded-2xl border border-sky-900/40 bg-sky-950/20 p-6">
		<h2 class="mb-2 text-lg font-semibold text-white">The full loop</h2>
		<ol class="list-decimal space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				Scan free at <a class="text-sky-400 hover:underline" href="/">deploylint.com</a>
			</li>
			<li>Start Solo ($9/mo) → paste every fix prompt into Cursor</li>
			<li>Re-scan to prove score delta</li>
			<li>Wire this gate into CI so regressions never ship</li>
		</ol>
	</section>

	<p>
		<a class="text-sky-400 hover:underline" href="/">← Back to scan</a>
	</p>
</div>
