# Deploylint Deep Audit Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Deploylint/preflight quality surface from "many passing tests" into a defensible product-quality program with verified browser flows, production smoke, scanner-depth guardrails, and explicit remaining manual checks.

**Architecture:** Keep `apps/preflight` as the product surface and `apps/preflight-mcp` as the agent integration surface. Strengthen confidence by adding targeted regression tests around proven gaps, then add quality gates for dimensions the current suite does not measure. Do not touch `apps/tcg-vault` in this plan.

**Tech Stack:** SvelteKit 5, Cloudflare Workers/Wrangler, Vitest 4 coverage, Playwright, npm workspaces, Turbo, Stripe, Plausible, Deploylint MCP.

---

## Audit Snapshot

Commands run on 2026-07-06:

- `npm.cmd run verify -w preflight`: passed. Evidence: 91 test files, 730 tests, coverage, lint, Svelte typecheck, production build.
- `npm.cmd run verify -w preflight-mcp`: passed. Evidence: 4 test files, 25 tests, coverage, lint, TypeScript build.
- `npm.cmd run test:e2e -w preflight`: initially failed because the home page e2e expected the old "Should you post this URL today?" positioning.
- `npm.cmd run test:e2e -w preflight` after remediation: passed. Evidence: 21/21 Playwright tests.
- `npm.cmd run smoke:preflight`: passed. Evidence: 45/45 scripted smoke assertions across phases 18, 19, 20, 23, and 24.
- `npm.cmd run verify:deploylint`: passed after adding the alias and smoke transport retry hardening. Evidence: preflight verify, MCP verify, 21/21 Playwright tests, and 45/45 smoke assertions.
- `npm.cmd audit --omit=dev --workspaces --json`: passed with 0 production vulnerabilities.
- `npm.cmd audit --audit-level=moderate --json`: only low-severity SvelteKit/cookie advisory surfaced.
- `npm.cmd run count:checks -w preflight`: 132 unique check/finding IDs.

Current known worktree context:

- In-progress scan-depth hardening changed `apps/preflight/src/lib/scan/**`.
- This plan adds a new file under `docs/superpowers/plans/`.
- Existing deleted `docs/superpowers/**` files were already dirty and are intentionally not part of this plan.

## Gap Ranking

1. **Resolved P0: Browser-flow drift can bypass local verify.** `preflight` unit/build verify passed while full Playwright e2e failed. CI runs e2e, but local `npm run verify -w preflight` does not. Closed by `verify:deploylint`.
2. **Resolved P0: Analytics aborts log as 500s.** Full e2e produced `[500] POST /api/events Error: aborted`. Closed by treating aborted analytics body reads as 204 no-content noise.
3. **P1: Manual payment proof is not automated.** Smoke creates checkout sessions and probes routes, but still requires manual Stripe checkout/webhook completion.
4. **P1: External GitHub Action proof is manual.** Smoke validates hosted gate assets and docs, but does not prove the published action inside a separate consumer repo.
5. **P1: Dead-code/export hygiene is absent.** `knip` is not installed, so quality gates do not detect unused exports, dead files, or stale dependencies.
6. **P1: Coverage has no enforced thresholds.** Coverage is high overall, but there are no configured minimums to prevent regression.
7. **P2: Production monitoring smoke is advisory.** Dogfood workflow uses Deploylint gate in advisory mode at score 70. That is useful, but not a release blocker.
8. **P2: MCP has strong unit coverage but no transport-level integration test.** Handlers are tested, but the actual MCP server process/tool listing is not exercised end-to-end.
9. **P2: Accessibility coverage is smoke-level.** There is a landmark/focus smoke, but no automated axe-style rule sweep.
10. **P3: Low-severity dev dependency advisory needs tracking.** Current production dependency audit is clean; full audit shows a low SvelteKit/cookie advisory.

## Task 0: Completed During Audit - Align E2E With Payment-Readiness Positioning

**Files:**
- Modified: `apps/preflight/e2e/seo.spec.ts`
- Modified: `apps/preflight/e2e/scan-error.spec.ts`

- [x] **Step 1: Reproduce failing e2e**

Run:

```powershell
npm.cmd run test:e2e -w preflight
```

Expected before fix:

```text
2 failed
SEO metadata / expected heading /Should you post this URL today/i
scan error / expected heading /Should you post this URL today/i
```

- [x] **Step 2: Update expected home metadata and heading**

Use the live source copy from `apps/preflight/src/routes/+page.svelte`:

```ts
{
	path: '/',
	title: 'Payment readiness checker for AI-built SaaS - Deploylint',
	description:
		'Scan an AI-built SaaS before charging users. Deploylint checks checkout, signed webhooks, entitlements, billing self-service, exposed secrets, SEO blockers, and launch polish.',
	canonical: `${baseUrl}/`,
	heading: /Can this AI-built SaaS safely take money/i,
	jsonLdTypes: ['WebApplication', 'Organization']
}
```

- [x] **Step 3: Update scan-error page-stability assertion**

Use the current H1:

```ts
await expect(
	page.getByRole('heading', { name: /Can this AI-built SaaS safely take money/i })
).toBeVisible();
```

- [x] **Step 4: Verify focused e2e**

Run:

```powershell
npm.cmd run test:e2e -w preflight -- e2e/seo.spec.ts e2e/scan-error.spec.ts
```

Expected: `11 passed`.

- [x] **Step 5: Verify full e2e**

Run:

```powershell
npm.cmd run test:e2e -w preflight
```

Expected: `21 passed`.

## Task 1: Suppress Expected Analytics Abort Noise

**Status:** Completed in this pass.

**Files:**
- Modify: `apps/preflight/src/lib/server/events-handler.ts`
- Modify: `apps/preflight/src/lib/server/events-handler.test.ts`

- [x] **Step 1: Write failing aborted-body test**

Add this test to `apps/preflight/src/lib/server/events-handler.test.ts`:

```ts
it('treats client-aborted analytics events as no-content noise', async () => {
	const request = {
		headers: new Headers({ 'Content-Type': 'application/json' }),
		text: async () => {
			throw new Error('aborted');
		}
	} as unknown as Request;

	const res = await handleEventsPost(request);

	expect(res.status).toBe(204);
});
```

- [x] **Step 2: Run focused test and verify failure**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/server/events-handler.test.ts
```

Expected before implementation: fails with `aborted`.

- [x] **Step 3: Implement abort classifier**

Patch `apps/preflight/src/lib/server/events-handler.ts`:

```ts
function isAbortNoise(err: unknown): boolean {
	return err instanceof Error && /\baborted\b/i.test(err.message);
}

export async function handleEventsPost(request: Request) {
	let body: unknown;
	try {
		body = await readJsonBody(request, 2048);
	} catch (err) {
		if (isAbortNoise(err)) return new Response(null, { status: 204 });
		throw err;
	}

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new UrlValidationError('Invalid event body');
	}

	const raw = body as Record<string, unknown>;
	const event = raw.event;
	if (typeof event !== 'string' || !isFunnelEventName(event)) {
		throw new UrlValidationError('Unknown event');
	}

	const payload = sanitizeFunnelPayload(raw);
	logFunnelEvent(event as FunnelEventName, payload);
	return json({ ok: true });
}
```

- [x] **Step 4: Verify focused and e2e**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/server/events-handler.test.ts
npm.cmd run test:e2e -w preflight
```

Observed: unit test passed; full e2e passed `21/21` with no `[500] POST /api/events Error: aborted` noise.

## Task 2: Add A Fast Full-Confidence Local Gate Alias

**Status:** Completed in this pass.

**Files:**
- Modify: `package.json`
- Modify: `apps/preflight/README.md`
- Add: `apps/preflight/scripts/smoke-http.mjs`
- Modify: `apps/preflight/scripts/smoke-phase18.mjs`
- Modify: `apps/preflight/scripts/smoke-phase19.mjs`
- Modify: `apps/preflight/scripts/smoke-phase20.mjs`
- Modify: `apps/preflight/scripts/smoke-phase23.mjs`
- Modify: `apps/preflight/scripts/smoke-phase24.mjs`

- [x] **Step 1: Add root script for relevant product scope**

Patch root `package.json` scripts:

```json
"verify:deploylint": "npm run verify -w preflight && npm run verify -w preflight-mcp && npm run test:e2e -w preflight && npm run smoke:preflight"
```

- [x] **Step 2: Document when to run each gate**

Add a short section to `apps/preflight/README.md`:

```md
## Verification

- `npm.cmd run verify -w preflight` checks type safety, lint, unit coverage, and production build.
- `npm.cmd run verify -w preflight-mcp` checks the MCP package.
- `npm.cmd run test:e2e -w preflight` checks browser-level user flows.
- `npm.cmd run smoke:preflight` checks production-facing scan, billing, crawler, and gate surfaces.
- `npm.cmd run verify:deploylint` runs the full Deploylint confidence gate.
```

- [x] **Step 3: Verify**

Run:

```powershell
npm.cmd run verify:deploylint
```

Observed: first run exposed a production smoke connect timeout to `deploylint.com:443`; smoke phases now install a shared retry wrapper for thrown transport errors. Rerun passed preflight verify, MCP verify, 21/21 Playwright tests, and 45/45 smoke assertions.

## Task 3: Add Dead-Code Hygiene

**Files:**
- Modify: `package.json`
- Modify: `apps/preflight/package.json`
- Modify: `apps/preflight-mcp/package.json`
- Create: `knip.jsonc`

- [ ] **Step 1: Install knip as a root dev dependency**

Run:

```powershell
npm.cmd install --save-dev knip
```

- [ ] **Step 2: Add a conservative config**

Create `knip.jsonc`:

```jsonc
{
	"$schema": "https://unpkg.com/knip@latest/schema.json",
	"workspaces": {
		"apps/preflight": {
			"entry": [
				"src/routes/**/+*.ts",
				"src/routes/**/+*.svelte",
				"src/hooks.server.ts",
				"scripts/*.mjs",
				"scripts/*.ts",
				"e2e/*.spec.ts"
			],
			"project": ["src/**/*.{ts,svelte}", "e2e/**/*.ts", "scripts/**/*.{ts,mjs,js}"]
		},
		"apps/preflight-mcp": {
			"entry": ["src/index.ts"],
			"project": ["src/**/*.ts"]
		}
	},
	"ignore": [
		"apps/preflight/src/cloudflare-env.d.ts",
		"apps/preflight-mcp/dist/**"
	]
}
```

- [ ] **Step 3: Add scripts**

Patch root `package.json`:

```json
"deadcode": "knip"
```

Patch `apps/preflight/package.json` and `apps/preflight-mcp/package.json` only if workspace-local wrappers are needed:

```json
"deadcode": "knip --workspace apps/preflight"
```

- [ ] **Step 4: Run dead-code report**

Run:

```powershell
npm.cmd run deadcode
```

Expected: either clean or a bounded list of unused exports to triage. Do not auto-delete on first pass.

## Task 4: Enforce Coverage Thresholds Without Blocking Legitimate Refactors

**Files:**
- Modify: `apps/preflight/vite.config.ts`
- Modify: `apps/preflight-mcp/vite.config.ts`

- [ ] **Step 1: Set package-level thresholds just below current observed coverage**

Patch `apps/preflight/vite.config.ts` Vitest coverage config:

```ts
coverage: {
	provider: 'v8',
	reporter: ['text', 'html'],
	thresholds: {
		statements: 90,
		branches: 82,
		functions: 95,
		lines: 92
	}
}
```

Patch `apps/preflight-mcp/vite.config.ts`:

```ts
coverage: {
	provider: 'v8',
	reporter: ['text', 'html'],
	thresholds: {
		statements: 95,
		branches: 82,
		functions: 100,
		lines: 96
	}
}
```

- [ ] **Step 2: Verify thresholds**

Run:

```powershell
npm.cmd run test:coverage -w preflight
npm.cmd run test:coverage -w preflight-mcp
```

Expected: both pass.

## Task 5: Strengthen Low-Coverage Operational Modules

**Files:**
- Modify tests near:
  - `apps/preflight/src/lib/scan/fetchers.test.ts`
  - `apps/preflight/src/lib/scan/coverage.test.ts`
  - `apps/preflight/src/lib/client/preflight-session.test.ts`
  - `apps/preflight/src/lib/server/scan-handler.test.ts`

- [ ] **Step 1: Cover blocked scan message variants**

Add cases for `blockedScanMessage(401)`, `blockedScanMessage(500)`, and `blockedScanMessage(418)` in `coverage.test.ts`.

- [ ] **Step 2: Cover fetcher timeout and non-HTML branches**

Add tests in `fetchers.test.ts` with mocked `fetch` returning timeout/invalid content-type paths.

- [ ] **Step 3: Cover scan handler validation and unlock branches**

Add cases in `scan-handler.test.ts` for invalid body, missing env fallback, and alpha unlock behavior.

- [ ] **Step 4: Verify**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/coverage.test.ts src/lib/scan/fetchers.test.ts src/lib/server/scan-handler.test.ts src/lib/client/preflight-session.test.ts
npm.cmd run verify -w preflight
```

Expected: focused tests and full verify pass.

## Task 6: Automate Stripe Payment Proof As Far As Possible

**Files:**
- Modify: `apps/preflight/scripts/test-webhook.ps1`
- Modify or create: `apps/preflight/scripts/smoke-stripe-webhook.mjs`
- Modify: `apps/preflight/package.json`

- [ ] **Step 1: Add a script that triggers Stripe webhook fixtures and asserts Cloudflare route acceptance**

Add a Node script that calls the local route with a signed test payload when `STRIPE_WEBHOOK_SECRET` is available. Keep real Stripe CLI checkout completion as manual if credentials are not present.

- [ ] **Step 2: Add script**

Patch `apps/preflight/package.json`:

```json
"smoke:stripe-webhook": "node scripts/smoke-stripe-webhook.mjs"
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm.cmd run smoke:stripe-webhook -w preflight
```

Expected: skips with a clear message when secrets are absent; validates signature and returns 2xx when secrets are present.

## Task 7: Add MCP Transport-Level Smoke

**Files:**
- Modify: `apps/preflight-mcp/src/server.test.ts`
- Create: `apps/preflight-mcp/src/index.integration.test.ts`

- [ ] **Step 1: Spawn the MCP server process in a test**

Use `node dist/index.js` after build or `tsx src/index.ts` in test mode and request tool listing over stdio.

- [ ] **Step 2: Assert both current and deprecated tool names**

Expected tool names:

```ts
[
	'deploylint_scan',
	'deploylint_gate',
	'preflight_scan',
	'preflight_gate'
]
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm.cmd run verify -w preflight-mcp
```

Expected: MCP package verify passes and proves the server can start through its real entrypoint.

## Task 8: Add Automated Accessibility Sweep

**Files:**
- Modify: `apps/preflight/package.json`
- Modify: `apps/preflight/e2e/a11y-smoke.spec.ts`

- [ ] **Step 1: Install axe for Playwright**

Run:

```powershell
npm.cmd install --save-dev -w preflight @axe-core/playwright
```

- [ ] **Step 2: Add axe scan for core pages**

Extend `a11y-smoke.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';

for (const path of ['/', '/compare', '/developers', '/checks']) {
	test(`axe scan ${path}`, async ({ page }) => {
		await page.goto(path);
		const results = await new AxeBuilder({ page }).analyze();
		expect(results.violations).toEqual([]);
	});
}
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm.cmd run test:e2e -w preflight -- e2e/a11y-smoke.spec.ts
```

Expected: no accessibility violations on core pages.

## Task 9: Make Production Dogfood Gate Intentional

**Files:**
- Modify: `.github/workflows/deploylint-dogfood.yml`

- [ ] **Step 1: Add scheduled run**

Patch workflow:

```yaml
on:
  schedule:
    - cron: "17 13 * * *"
  pull_request:
    paths:
      - "apps/preflight/**"
      - "apps/preflight-mcp/**"
      - ".github/actions/deploylint-gate/**"
      - ".github/workflows/deploylint-dogfood.yml"
  workflow_dispatch:
```

- [ ] **Step 2: Keep advisory until score policy is explicit**

Do not change `mode: advisory` until the product team chooses a production score floor and no-go policy.

- [ ] **Step 3: Verify YAML**

Run:

```powershell
npm.cmd run format:check
```

Expected: formatting remains clean.

## Task 10: Track Low-Severity Dependency Advisory

**Files:**
- Modify: `apps/preflight/CHANGELOG.md` or create a short security note if this becomes user-visible.
- No code change if the advisory remains low and no patched compatible version exists.

- [ ] **Step 1: Re-run audit**

Run:

```powershell
npm.cmd audit --audit-level=moderate --json
npm.cmd audit --omit=dev --workspaces --json
```

Expected: production audit remains 0 vulnerabilities.

- [ ] **Step 2: Upgrade when SvelteKit-compatible fix is available**

Run:

```powershell
npm.cmd update @sveltejs/kit @sveltejs/adapter-cloudflare -w preflight -w tcg-vault
npm.cmd run verify -w preflight
npm.cmd run verify -w preflight-mcp
```

Expected: no breaking framework changes. Keep this task separate from scanner changes.

## Final Verification Gate

Run after completing any task batch:

```powershell
npm.cmd run verify -w preflight
npm.cmd run verify -w preflight-mcp
npm.cmd run test:e2e -w preflight
npm.cmd run smoke:preflight
git diff --check
git status --short --branch
```

Expected:

- Preflight verify passes.
- MCP verify passes.
- 21 Playwright e2e tests pass.
- Smoke phases pass.
- No whitespace errors.
- Dirty status contains only intentional files for the current task batch plus any pre-existing unrelated deletes.
