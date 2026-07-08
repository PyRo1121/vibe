<script lang="ts">
	import { resolve } from '$app/paths';
	import CiReportPreview from '$lib/components/CiReportPreview.svelte';
	import SeoHead from '$lib/components/SeoHead.svelte';
	import { buildPageJsonLd, buildSeoTitle, defaultSeoImage } from '$lib/site/seo-metadata';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const base = $derived(data.appUrl.replace(/\/$/, ''));
	const title = buildSeoTitle('Install Deploylint in GitHub Actions');
	const description =
		'Install Deploylint in GitHub Actions as an advisory PR report first, then switch to a blocking deploy gate when the signal is clean.';
	const canonical = $derived(`${base}/developers`);
	const jsonLd = $derived([
		{
			...buildPageJsonLd({ base, canonical, title, description, type: 'TechArticle' }),
			headline: title,
			about: 'Deploylint advisory CI reports and deploy gates'
		},
		{
			'@context': 'https://schema.org',
			'@type': 'HowTo',
			name: 'Add a Deploylint advisory CI report',
			description,
			inLanguage: 'en-US',
			isPartOf: {
				'@id': `${base}/#website`
			},
			step: [
				{
					'@type': 'HowToStep',
					name: 'Generate a workspace-backed project workflow in Deploylint'
				},
				{ '@type': 'HowToStep', name: 'Set DEPLOYLINT_URL to your staging or production URL' },
				{ '@type': 'HowToStep', name: 'Run Deploylint in advisory mode from GitHub Actions' },
				{ '@type': 'HowToStep', name: 'Switch to blocking gate mode after the report is clean' }
			]
		}
	]);

	const advisoryGateYaml = $derived(`name: Deploylint advisory report

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

	const workspaceBackedGateYaml = $derived(`name: Deploylint workspace advisory report

on:
  pull_request:
  workflow_dispatch:

permissions: {}

jobs:
  deploylint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Run Deploylint workspace report
        env:
          DEPLOYLINT_PROJECT_ID: proj_demo_123
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

	const blockingGateYaml = $derived(`name: Deploylint deploy gate

on:
  pull_request:
  push:
    branches: [main]

permissions: {}

jobs:
  deploylint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Block when Deploylint finds configured blockers
        env:
          DEPLOYLINT_URL: \${{ secrets.DEPLOYLINT_URL }}
          DEPLOYLINT_API: ${base}
          DEPLOYLINT_MODE: gate
          DEPLOYLINT_MIN_SCORE: '80'
        run: |
          curl -fsSL ${base}/gate-remote.mjs -o gate-remote.mjs
          node gate-remote.mjs "$DEPLOYLINT_URL"`);

	const compositeActionYaml = $derived(`name: Deploylint deploy gate

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  deploylint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Copy .github/actions/deploylint-gate from a reviewed release tag or commit SHA.
      # Or use the zero-install workflow above.
      - uses: ./.github/actions/deploylint-gate
        with:
          url: \${{ secrets.DEPLOYLINT_URL }}
          api: ${base}
          min_score: '80'
          mode: gate`);

	const hostedScript = $derived(`curl -fsSL ${base}/gate-remote.mjs -o gate-remote.mjs
DEPLOYLINT_URL=https://your-app.com DEPLOYLINT_MODE=advisory node gate-remote.mjs`);

	const localGate = $derived(`npm run gate -w preflight -- https://your-app.com

# Or with env vars:
DEPLOYLINT_URL=https://your-app.com DEPLOYLINT_MIN_SCORE=80 npm run gate -w preflight`);

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
</script>

<SeoHead {title} {description} {canonical} image={defaultSeoImage(base)} {jsonLd} />

<div class="mx-auto max-w-5xl px-4 py-12 text-zinc-300">
	<section class="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
		<div>
			<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
				Install in GitHub Actions
			</p>
			<h1 class="mb-4 max-w-3xl text-3xl font-bold text-white sm:text-5xl">
				Add a deploy-risk report to every pull request.
			</h1>
			<p class="text-lg leading-8 text-zinc-400">
				Start with a
				<strong class="font-medium text-zinc-200">non-blocking advisory report</strong>. It shows
				risky workflow permissions, missing quality gates, repo hygiene drift, and deploy target
				issues without failing builds. Once the signal is clean, switch the same workflow to gate
				mode.
			</p>
		</div>
		<CiReportPreview compact />
	</section>

	<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
		<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
			<div>
				<p class="mb-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
					Recommended path
				</p>
				<h2 class="text-xl font-semibold text-white">
					Generate the workspace-backed project gate first
				</h2>
				<p class="mt-3 text-sm leading-6 text-zinc-400">
					The optional URL-only advisory workflow below is a quick signal check. A workspace-backed
					project gate is the product path: it adds <code
						class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_PROJECT_ID</code
					>, report history, billing context, and gate status inside your Deploylint workspace.
				</p>
			</div>
			<div class="flex flex-col justify-center gap-3">
				<a
					href={resolve('/app#install')}
					class="rounded-lg bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-sky-500"
				>
					Generate workspace workflow
				</a>
				<p class="text-xs leading-5 text-zinc-500">
					Use this after login to create the exact workflow for a monitored project.
				</p>
			</div>
		</div>
		<pre
			class="mt-5 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{workspaceBackedGateYaml}</code
			></pre>
	</section>

	<section class="mb-10 rounded-2xl border border-sky-900/50 bg-sky-950/20 p-6">
		<h2 class="mb-2 text-xl font-semibold text-white">Fallback: URL-only advisory workflow</h2>
		<p class="mb-4 text-sm leading-6 text-zinc-400">
			Set a GitHub secret named
			<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_URL</code>
			to your staging or production URL. Use this only when you need deploy evidence before a workspace
			exists; it writes an Actions job summary and always exits successfully.
		</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{advisoryGateYaml}</code
			></pre>
		<p class="mt-4 text-sm leading-6 text-zinc-500">
			Move to the workspace-backed workflow before making Deploylint a required status check. That
			keeps project history, billing context, and gate policy attached to the same record.
		</p>
	</section>

	<section class="mb-10 grid gap-4 md:grid-cols-3">
		<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Why adopt</p>
			<p class="mt-2 font-semibold text-white">Agent-built changes get a second reviewer</p>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Deploylint watches the CI and deploy path that AI coding agents commonly weaken or skip.
			</p>
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Why pay</p>
			<p class="mt-2 font-semibold text-white">The value is the always-on gate</p>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				The free tools prove the signal; the paid workflow keeps risky deploys from shipping later.
			</p>
		</div>
		<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Why trust</p>
			<p class="mt-2 font-semibold text-white">Advisory first, blocking later</p>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Teams can read reports for a few PRs before letting Deploylint fail a build.
			</p>
		</div>
	</section>

	<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
		<h2 class="mb-2 text-xl font-semibold text-white">What blocking mode checks</h2>
		<ul class="list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				<strong class="text-zinc-300">NO-GO</strong> verdict from configured production blockers
			</li>
			<li>
				Score below <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300"
					>DEPLOYLINT_MIN_SCORE</code
				> (default 80)
			</li>
			<li>
				Any P0 check failure: exposed secrets, missing privacy page, HTTPS, noindex, robots blocking
				Google, unsafe workflow patterns, and similar deploy risks
			</li>
		</ul>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">2. Switch to blocking mode</h2>
		<p class="mb-4 text-sm text-zinc-500">
			After advisory reports are clean, change
			<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_MODE</code>
			to <code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">gate</code>. The job exits
			non-zero when the score drops below the threshold or P0 blockers remain.
		</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{blockingGateYaml}</code
			></pre>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">3. Composite GitHub Action</h2>
		<p class="mb-4 text-sm text-zinc-500">
			The zero-install workflow above is the easiest path. If you prefer vendoring, copy
			<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300"
				>.github/actions/deploylint-gate</code
			>
			from a reviewed release tag or commit SHA of the
			<a class="text-sky-400 hover:underline" href="https://github.com/PyRo1121/vibe"
				>Deploylint source repo</a
			>
			and set the
			<code class="rounded bg-zinc-800 px-1.5 py-0.5 text-sky-300">DEPLOYLINT_URL</code>
			secret.
		</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{compositeActionYaml}</code
			></pre>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">4. Zero-install script</h2>
		<p class="mb-4 text-sm text-zinc-500">
			Fetch the hosted gate from
			<a class="text-sky-400 hover:underline" href={resolve('/gate-remote.mjs')}>/gate-remote.mjs</a
			>
			for local scripts or non-GitHub CI.
		</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{hostedScript}</code
			></pre>
		<p class="mt-3 text-sm text-zinc-500">
			Exit code <strong class="text-zinc-400">0</strong> = pass or advisory report,
			<strong class="text-zinc-400">1</strong> = blocking gate failed,
			<strong class="text-zinc-400">2</strong> = usage/API error.
		</p>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">5. Monorepo CLI</h2>
		<p class="mb-4 text-sm text-zinc-500">If you fork or clone the Deploylint repo:</p>
		<pre
			class="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{localGate}</code
			></pre>
	</section>

	<section class="mb-10">
		<h2 class="mb-2 text-xl font-semibold text-white">6. Advanced: Cursor MCP + agent skill</h2>
		<p class="mb-4 text-sm text-zinc-500">
			MCP is useful after CI is working. Today it requires cloning this repo or copying
			<code class="text-sky-300">apps/preflight-mcp</code>.
		</p>
		<pre
			class="mb-4 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{mcpJson}</code
			></pre>
		<ul class="list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				<code class="text-sky-300">deploylint_gate</code> returns PASS/FAIL;
				<code class="text-sky-300">advisory: true</code> reports without blocking.
			</li>
			<li>
				<code class="text-sky-300">deploylint_scan</code> returns target evidence, risks, issues, and
				repair prompts for agent workflows.
			</li>
			<li>
				Legacy <code class="text-sky-300">preflight_scan</code> /
				<code class="text-sky-300">preflight_gate</code> aliases still work.
			</li>
		</ul>
	</section>

	<section class="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
		<h2 class="mb-2 text-lg font-semibold text-white">What Deploylint can and cannot see</h2>
		<ul class="list-disc space-y-2 pl-6 text-sm text-zinc-400">
			<li>Deploylint is a CI and deploy-target signal, not a full security audit.</li>
			<li>Advisory mode never blocks builds.</li>
			<li>Blocking mode only blocks on Deploylint's configured score, verdict, and P0 rules.</li>
			<li>Public repo scans inspect public files and sampled surfaces.</li>
			<li>
				Keep GitHub branch protection, reviews, secret scanning, CodeQL, and dependency review in
				place.
			</li>
			<li>
				The hosted script executes remote code from Deploylint during CI; vendor it if your
				supply-chain policy requires pinned scripts.
			</li>
		</ul>
	</section>

	<section class="mb-10 rounded-2xl border border-sky-900/40 bg-sky-950/20 p-6">
		<h2 class="mb-2 text-lg font-semibold text-white">The adoption loop</h2>
		<ol class="list-decimal space-y-2 pl-6 text-sm text-zinc-400">
			<li>
				Check workflow YAML in the
				<a
					class="text-sky-400 hover:underline"
					href={resolve('/tools/github-actions-security-checker')}
					>GitHub Actions Security Checker</a
				>.
			</li>
			<li>Add the advisory workflow and read the first PR report.</li>
			<li>Fix the highest-risk findings and rerun the advisory report.</li>
			<li>Switch to gate mode only after the advisory report is clean.</li>
		</ol>
	</section>

	<p>
		<a class="text-sky-400 hover:underline" href={resolve('/')}>Build readiness evidence</a>
	</p>
</div>
