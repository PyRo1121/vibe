# Deploylint Activation Dashboard Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/app` into a clear activation command center for a logged-in Deploylint workspace.

**Architecture:** Keep persistence out of this slice. Add deterministic activation state derivation in `$lib/product/workspace`, return it from the `/app` server load, and render a stronger dashboard UI from that model.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest, Tailwind utilities, Cloudflare Workers/D1 context.

## Global Constraints

- Do not build full database-backed project CRUD in this slice.
- Do not pull live GitHub repository data.
- Do not receive real CI reports into the workspace.
- Do not build a full account settings area.
- Do not change the homepage scanner/report behavior.
- Preserve signed-out redirect to `/login?redirectTo=%2Fapp`.
- Keep activation derivation in `$lib/product/workspace`, not inside the Svelte component.
- Use existing Tailwind/zinc/sky styling and the current dashboard shell.
- `npm.cmd run verify -w preflight` must pass before commit.

---

## File Structure

- Modify `apps/preflight/src/lib/product/workspace.ts`: add activation status types and pure derivation helpers.
- Modify `apps/preflight/src/lib/product/workspace.test.ts`: cover activation states and next actions.
- Modify `apps/preflight/src/routes/app/+page.server.ts`: return `activation` from the load function and avoid assuming a project exists without a fallback.
- Modify `apps/preflight/src/routes/app/page.server.test.ts`: assert activation data is returned with authenticated workspace data.
- Modify `apps/preflight/src/routes/app/page.source.test.ts`: assert the app page includes activation, next-action, install, report-history, and gate surfaces.
- Modify `apps/preflight/src/routes/app/+page.svelte`: render the activation command center.

---

### Task 1: Workspace Activation Model

**Files:**
- Modify: `apps/preflight/src/lib/product/workspace.ts`
- Test: `apps/preflight/src/lib/product/workspace.test.ts`

**Interfaces:**
- Consumes: `DeploylintWorkspace`, `DeploylintProject`, `ProjectInstallState`
- Produces:
  - `ActivationStepStatus = 'complete' | 'current' | 'locked'`
  - `WorkspaceActivationStep`
  - `WorkspaceNextAction`
  - `WorkspaceActivation`
  - `buildWorkspaceActivation(workspace: DeploylintWorkspace): WorkspaceActivation`

- [ ] **Step 1: Write failing activation model tests**

Add this import:

```ts
import {
	buildAdvisoryWorkflow,
	buildDemoWorkspace,
	buildWorkspaceActivation,
	workspaceActivationSteps
} from './workspace';
```

Append these tests to `apps/preflight/src/lib/product/workspace.test.ts`:

```ts
	it('marks workflow install as the current next action before CI is installed', () => {
		const workspace = buildDemoWorkspace({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: true
		});

		const activation = buildWorkspaceActivation(workspace);

		expect(activation.progress).toEqual({ completed: 1, total: 4, percentage: 25 });
		expect(activation.nextAction).toMatchObject({
			id: 'workflow',
			label: 'Install advisory workflow',
			ctaLabel: 'Copy workflow'
		});
		expect(activation.steps.map((step) => [step.id, step.status])).toEqual([
			['project', 'complete'],
			['workflow', 'current'],
			['first-report', 'locked'],
			['gate', 'locked']
		]);
	});

	it('moves the next action to first report after advisory install', () => {
		const workspace = buildDemoWorkspace({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: false
		});
		workspace.projects[0].installState = 'advisory_installed';

		const activation = buildWorkspaceActivation(workspace);

		expect(activation.progress).toEqual({ completed: 2, total: 4, percentage: 50 });
		expect(activation.nextAction).toMatchObject({
			id: 'first-report',
			label: 'Open first advisory report',
			ctaLabel: 'Wait for CI report'
		});
		expect(activation.steps.map((step) => [step.id, step.status])).toEqual([
			['project', 'complete'],
			['workflow', 'complete'],
			['first-report', 'current'],
			['gate', 'locked']
		]);
	});

	it('marks activation complete when the deploy gate is enabled', () => {
		const workspace = buildDemoWorkspace({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: false
		});
		workspace.projects[0].installState = 'gate_enabled';
		workspace.projects[0].gateMode = 'gate';
		workspace.metrics.activeProjects = 1;
		workspace.metrics.gatesEnabled = 1;
		workspace.metrics.reportsThisMonth = 7;

		const activation = buildWorkspaceActivation(workspace);

		expect(activation.progress).toEqual({ completed: 4, total: 4, percentage: 100 });
		expect(activation.nextAction).toMatchObject({
			id: 'gate',
			label: 'Deploy gate active',
			ctaLabel: 'Review reports'
		});
		expect(activation.steps.every((step) => step.status === 'complete')).toBe(true);
	});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/product/workspace.test.ts
```

Expected: FAIL because `buildWorkspaceActivation` is not exported.

- [ ] **Step 3: Implement activation model**

In `apps/preflight/src/lib/product/workspace.ts`, add these types after `DeploylintWorkspace`:

```ts
export type ActivationStepStatus = 'complete' | 'current' | 'locked';

export interface WorkspaceActivationStep {
	id: (typeof workspaceActivationSteps)[number]['id'];
	label: string;
	description: string;
	status: ActivationStepStatus;
	ctaLabel: string;
	href: string;
}

export interface WorkspaceNextAction {
	id: WorkspaceActivationStep['id'];
	label: string;
	description: string;
	ctaLabel: string;
	href: string;
}

export interface WorkspaceActivation {
	steps: WorkspaceActivationStep[];
	nextAction: WorkspaceNextAction;
	progress: {
		completed: number;
		total: number;
		percentage: number;
	};
}
```

Add this helper block after `workspaceActivationSteps`:

```ts
const ACTIVATION_CTA: Record<
	(typeof workspaceActivationSteps)[number]['id'],
	{ ctaLabel: string; href: string }
> = {
	project: { ctaLabel: 'Review project', href: '#project' },
	workflow: { ctaLabel: 'Copy workflow', href: '#install' },
	'first-report': { ctaLabel: 'Wait for CI report', href: '#reports' },
	gate: { ctaLabel: 'Review reports', href: '#gate' }
};

function completedActivationIds(project: DeploylintProject | undefined): Set<WorkspaceActivationStep['id']> {
	const completed = new Set<WorkspaceActivationStep['id']>();
	if (!project) return completed;

	completed.add('project');
	if (project.installState === 'advisory_installed' || project.installState === 'gate_enabled') {
		completed.add('workflow');
	}
	if (project.latestReport || project.installState === 'gate_enabled') {
		completed.add('first-report');
	}
	if (project.installState === 'gate_enabled' && project.gateMode === 'gate') {
		completed.add('gate');
	}

	return completed;
}

export function buildWorkspaceActivation(workspace: DeploylintWorkspace): WorkspaceActivation {
	const project = workspace.projects[0];
	const completed = completedActivationIds(project);
	const current =
		workspaceActivationSteps.find((step) => !completed.has(step.id)) ??
		workspaceActivationSteps[workspaceActivationSteps.length - 1];

	const steps = workspaceActivationSteps.map((step) => {
		const cta = ACTIVATION_CTA[step.id];
		return {
			...step,
			...cta,
			status: completed.has(step.id)
				? 'complete'
				: step.id === current.id
					? 'current'
					: 'locked'
		};
	});

	const total = steps.length;
	const completedCount = steps.filter((step) => step.status === 'complete').length;
	const currentStep = steps.find((step) => step.id === current.id) ?? steps[steps.length - 1];
	const allComplete = completedCount === total;

	return {
		steps,
		nextAction: {
			id: currentStep.id,
			label: allComplete ? 'Deploy gate active' : currentStep.label,
			description: allComplete
				? 'Your project is installed, reporting, and ready to block risky deploys.'
				: currentStep.description,
			ctaLabel: currentStep.ctaLabel,
			href: currentStep.href
		},
		progress: {
			completed: completedCount,
			total,
			percentage: Math.round((completedCount / total) * 100)
		}
	};
}
```

- [ ] **Step 4: Run focused test**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/product/workspace.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit task 1**

Run:

```powershell
git add apps/preflight/src/lib/product/workspace.ts apps/preflight/src/lib/product/workspace.test.ts
git commit -m "feat(preflight): derive workspace activation state"
```

---

### Task 2: App Server Activation Data

**Files:**
- Modify: `apps/preflight/src/routes/app/+page.server.ts`
- Test: `apps/preflight/src/routes/app/page.server.test.ts`

**Interfaces:**
- Consumes: `buildWorkspaceActivation(workspace: DeploylintWorkspace): WorkspaceActivation`
- Produces: page data property `activation: WorkspaceActivation`

- [ ] **Step 1: Write failing server load assertion**

Add this assertion to the authenticated-user test in `apps/preflight/src/routes/app/page.server.test.ts`:

```ts
		expect(pageData.activation.nextAction).toMatchObject({
			id: 'workflow',
			ctaLabel: 'Copy workflow'
		});
		expect(pageData.activation.progress).toEqual({
			completed: 1,
			total: 4,
			percentage: 25
		});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```powershell
npm.cmd run test -w preflight -- src/routes/app/page.server.test.ts
```

Expected: FAIL because `activation` is not returned from `load`.

- [ ] **Step 3: Return activation from app load**

Change the import in `apps/preflight/src/routes/app/+page.server.ts` to:

```ts
import {
	buildAdvisoryWorkflow,
	buildDemoWorkspace,
	buildWorkspaceActivation
} from '$lib/product/workspace';
```

Change the end of the load function to:

```ts
	const project = workspace.projects[0];
	const activation = buildWorkspaceActivation(workspace);

	return {
		appUrl: appUrl.replace(/\/$/, ''),
		user: {
			id: locals.user.id,
			name: locals.user.name,
			email: locals.user.email,
			image: locals.user.image
		},
		workspace,
		activation,
		advisoryWorkflow: project
			? buildAdvisoryWorkflow({
					appUrl,
					projectId: project.id,
					deployUrl: project.deployUrl
				})
			: ''
	};
```

- [ ] **Step 4: Run focused server tests**

Run:

```powershell
npm.cmd run test -w preflight -- src/routes/app/page.server.test.ts src/lib/product/workspace.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit task 2**

Run:

```powershell
git add apps/preflight/src/routes/app/+page.server.ts apps/preflight/src/routes/app/page.server.test.ts
git commit -m "feat(preflight): expose activation state to app"
```

---

### Task 3: Activation Dashboard UI

**Files:**
- Modify: `apps/preflight/src/routes/app/+page.svelte`
- Test: `apps/preflight/src/routes/app/page.source.test.ts`

**Interfaces:**
- Consumes page data:
  - `data.workspace`
  - `data.activation`
  - `data.advisoryWorkflow`
  - `data.user`

- [ ] **Step 1: Write failing app source test**

Update the second test in `apps/preflight/src/routes/app/page.source.test.ts` to include:

```ts
		expect(pageSource).toContain('Activation command center');
		expect(pageSource).toContain('Next action');
		expect(pageSource).toContain('Report history');
		expect(pageSource).toContain('Gate status');
		expect(pageSource).toContain('navigator.clipboard.writeText');
		expect(pageSource).toContain('data.activation');
```

- [ ] **Step 2: Run source test and confirm failure**

Run:

```powershell
npm.cmd run test -w preflight -- src/routes/app/page.source.test.ts
```

Expected: FAIL because the page does not yet contain the new activation surfaces or copy action.

- [ ] **Step 3: Add copy state and activation derived values**

In `apps/preflight/src/routes/app/+page.svelte`, add these state declarations after `let { data }`:

```svelte
	let workflowCopied = $state(false);
	let workflowCopyError = $state<string | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | null = null;
```

Add these derived values after the existing `project` derived value:

```svelte
	const activation = $derived(data.activation);
	const progressLabel = $derived(
		`${activation.progress.completed}/${activation.progress.total} complete`
	);
```

Add this function before the closing `</script>`:

```svelte
	async function copyWorkflow() {
		workflowCopyError = null;
		try {
			await navigator.clipboard.writeText(data.advisoryWorkflow);
			workflowCopied = true;
			if (copyTimer) clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (workflowCopied = false), 2000);
		} catch {
			workflowCopyError = 'Copy failed. Select the workflow text manually.';
		}
	}
```

- [ ] **Step 4: Replace the hero and metrics area with activation command center**

Replace the first `<section class="mb-8 grid gap-6 ...">...</section>` and the following metrics `<section class="mb-8 grid gap-4 md:grid-cols-3">...</section>` with:

```svelte
	<section class="mb-8">
		<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p class="mb-3 text-sm font-medium tracking-widest text-sky-400 uppercase">
					Activation command center
				</p>
				<h1 class="max-w-4xl text-3xl font-bold tracking-tight text-white sm:text-5xl">
					Turn a workflow check into a deploy gate.
				</h1>
				<p class="mt-3 max-w-3xl text-base leading-7 text-zinc-400">
					Deploylint is now organized around projects, CI reports, and gate enforcement. Start
					advisory, prove the signal, then switch on blocking.
				</p>
			</div>
			<p class="text-sm text-zinc-500">
				Signed in as <span class="text-zinc-300">{data.user.email}</span>
			</p>
		</div>

		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
			<div class="rounded-xl border border-sky-500/30 bg-sky-950/20 p-5">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
							Next action
						</p>
						<h2 class="mt-2 text-2xl font-semibold text-white">{activation.nextAction.label}</h2>
						<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
							{activation.nextAction.description}
						</p>
					</div>
					<a
						href={activation.nextAction.href}
						class="rounded-lg bg-sky-500 px-4 py-2 text-center text-sm font-semibold text-zinc-950 hover:bg-sky-400"
					>
						{activation.nextAction.ctaLabel}
					</a>
				</div>
				<div class="mt-5">
					<div class="mb-2 flex items-center justify-between text-xs text-zinc-400">
						<span>Activation progress</span>
						<span>{progressLabel}</span>
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-zinc-800">
						<div
							class="h-full rounded-full bg-sky-400"
							style={`width: ${activation.progress.percentage}%`}
						></div>
					</div>
				</div>
			</div>

			<aside class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
				<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
					{workspace.ownerLabel}
				</p>
				<h2 class="mt-2 text-xl font-semibold text-white">{workspace.billing.planLabel}</h2>
				<p class="mt-2 text-sm leading-6 text-zinc-400">
					{workspace.billing.projectLimit} monitored project included. Billing attaches to
					projects, reports, and gates instead of a single scanned URL.
				</p>
			</aside>
		</div>
	</section>
```

- [ ] **Step 5: Replace current project and activation sidebar section**

Replace the `<section class="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">...</section>` block with:

```svelte
	<section class="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
		<div id="project" class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
						Project setup
					</p>
					<h2 class="mt-2 text-2xl font-semibold text-white">{project?.name ?? 'New project'}</h2>
					<p class="mt-2 text-sm text-zinc-400">
						{project?.repoLabel ?? 'Connect a repository in the next setup loop.'}
					</p>
				</div>
				<span
					class="w-fit rounded-full border border-amber-500/40 px-3 py-1 text-xs text-amber-200"
				>
					{project?.installState === 'not_installed'
						? 'Advisory not installed'
						: project?.installState}
				</span>
			</div>

			<div class="mt-6 grid gap-4 sm:grid-cols-4">
				<div>
					<p class="text-xs text-zinc-500">Deploy target</p>
					<p class="mt-1 font-mono text-sm text-zinc-200">{project?.deployUrl ?? 'Not set'}</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Workflow</p>
					<p class="mt-1 font-mono text-sm text-zinc-200">
						{project?.workflowPath ?? '.github/workflows/deploylint.yml'}
					</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Mode</p>
					<p class="mt-1 text-sm font-medium text-zinc-200">{project?.gateMode ?? 'advisory'}</p>
				</div>
				<div>
					<p class="text-xs text-zinc-500">Minimum score</p>
					<p class="mt-1 text-sm font-medium text-zinc-200">{project?.minScore ?? 80}</p>
				</div>
			</div>
		</div>

		<aside class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Activation</p>
			<ol class="mt-4 space-y-4">
				{#each activation.steps as step, index (step.id)}
					<li class="flex gap-3">
						<span
							class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold {step.status ===
							'complete'
								? 'border-emerald-500/50 text-emerald-300'
								: step.status === 'current'
									? 'border-sky-500/60 text-sky-300'
									: 'border-zinc-700 text-zinc-500'}"
						>
							{index + 1}
						</span>
						<span>
							<span class="block text-sm font-semibold text-white">{step.label}</span>
							<span class="mt-1 block text-sm leading-5 text-zinc-500">{step.description}</span>
						</span>
					</li>
				{/each}
			</ol>
		</aside>
	</section>
```

- [ ] **Step 6: Replace install section and add report/gate sections**

Replace the existing `<section id="install" ...>...</section>` with:

```svelte
	<section id="install" class="mb-8 rounded-xl border border-sky-900/50 bg-sky-950/20 p-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<p class="text-xs font-semibold tracking-widest text-sky-300 uppercase">
					Install in GitHub Actions
				</p>
				<h2 class="mt-2 text-xl font-semibold text-white">Start in advisory mode</h2>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
					Advisory mode reports deploy risk without failing builds. Once the first report is clean,
					this same project can become a blocking gate.
				</p>
			</div>
			<button
				type="button"
				class="rounded-lg border border-sky-500/50 px-4 py-2 text-sm font-semibold text-sky-200 hover:border-sky-400 hover:text-white"
				onclick={copyWorkflow}
			>
				{workflowCopied ? 'Copied' : 'Copy workflow'}
			</button>
		</div>
		{#if workflowCopyError}
			<p class="mt-3 text-sm text-amber-300" role="alert">{workflowCopyError}</p>
		{/if}
		<pre
			class="mt-5 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-300"><code
				>{data.advisoryWorkflow}</code
			></pre>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		<div id="reports" class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Report history</p>
			<h2 class="mt-2 text-xl font-semibold text-white">No CI reports yet</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Install the advisory workflow and open a pull request. This area becomes the project report
				history with scores, blockers, regressions, and the recommended next fix.
			</p>
		</div>

		<div id="gate" class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
			<p class="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Gate status</p>
			<h2 class="mt-2 text-xl font-semibold text-white">
				{project?.gateMode === 'gate' ? 'Blocking gate enabled' : 'Advisory mode first'}
			</h2>
			<p class="mt-2 text-sm leading-6 text-zinc-400">
				Start non-blocking so the team can trust the signal. When reports are clean, switch to a
				blocking deploy gate that fails risky production changes.
			</p>
		</div>
	</section>
```

- [ ] **Step 7: Run source test and Svelte check**

Run:

```powershell
npm.cmd run test -w preflight -- src/routes/app/page.source.test.ts
npm.cmd run check -w preflight
```

Expected: both PASS.

- [ ] **Step 8: Run browser smoke locally**

Ensure the dev server is running on 5173. If needed:

```powershell
Start-Process -FilePath npm.cmd -ArgumentList @('run','dev','-w','preflight','--','--host','127.0.0.1','--port','5173') -WorkingDirectory 'C:\Users\olen\Documents\Coding\Vibe' -WindowStyle Hidden
```

Smoke commands:

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 5
Invoke-WebRequest -Uri 'http://127.0.0.1:5173/login' -UseBasicParsing -TimeoutSec 5
curl.exe -i -sS http://127.0.0.1:5173/app --max-time 5
```

Expected:
- `/` returns 200.
- `/login` returns 200.
- `/app` returns `303` to `/login?redirectTo=%2Fapp` when anonymous.

- [ ] **Step 9: Commit task 3**

Run:

```powershell
git add apps/preflight/src/routes/app/+page.svelte apps/preflight/src/routes/app/page.source.test.ts
git commit -m "feat(preflight): improve activation dashboard"
```

---

### Task 4: Final Verification And Publish

**Files:**
- No source files expected unless verification exposes a bug.

**Interfaces:**
- Consumes all prior task outputs.
- Produces verified branch ready to push/deploy.

- [ ] **Step 1: Run full verify**

Stop the local preflight Vite server first if it is holding `.svelte-kit/cloudflare`:

```powershell
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
	Where-Object { $_.CommandLine -match 'run dev -w preflight|vite.*--port 5173' } |
	ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Run:

```powershell
npm.cmd run verify -w preflight
```

Expected: PASS with `svelte-check found 0 errors and 0 warnings`, lint clean, all Vitest files passing, and Cloudflare adapter build done.

- [ ] **Step 2: Restart local dev server**

Run:

```powershell
Start-Process -FilePath npm.cmd -ArgumentList @('run','dev','-w','preflight','--','--host','127.0.0.1','--port','5173') -WorkingDirectory 'C:\Users\olen\Documents\Coding\Vibe' -WindowStyle Hidden
```

- [ ] **Step 3: Final status check**

Run:

```powershell
git status --short --branch
```

Expected: branch is ahead of origin by task commits and has no unstaged changes.

- [ ] **Step 4: Push branch**

Run:

```powershell
git push origin codex/preflight-check-quality-audit
```

Expected: push succeeds.

- [ ] **Step 5: Deploy if requested in this execution run**

Run:

```powershell
npm.cmd run deploy -w preflight
```

Expected: Wrangler uploads and reports a current Worker version ID.

---

## Self-Review

- Spec coverage: activation model, first-viewport hierarchy, next action, install workflow, report history, gate status, billing/account panel, no D1 CRUD, and verification are covered.
- Placeholder scan: no TBD/TODO/fill-in steps are present.
- Type consistency: `buildWorkspaceActivation`, `WorkspaceActivation`, `activation`, `nextAction`, and `progress` names are consistent across tasks.
