# Deploylint Superiority (C → B → A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase C check-depth (90+ checks), then Phase B developer wedge (MCP/skill/CI), then Phase A founder conversion UX — in that order per `docs/superpowers/specs/2026-07-04-deploylint-superiority-roadmap.md`.

**Architecture:** New read-only probes live in `probes.ts` + `checks/deployment-hygiene.ts`, wired through `engine.ts` → `ScanContext`. MCP/skill/CI changes are isolated to `apps/preflight-mcp` and `scripts/`. Conversion UX touches Svelte report components only after C+B ship.

**Tech Stack:** SvelteKit on Cloudflare Workers, Vitest, Stripe (existing), MCP SDK, PowerShell smoke scripts.

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/scan/probes.ts` | Add `probeExposedPaths`, `probeHealthEndpoints` |
| `src/lib/scan/checks/deployment-hygiene.ts` | Checks from probe results + manifest/debug |
| `src/lib/scan/checks/context.ts` | Extend `ScanContext` with probe payloads |
| `src/lib/scan/engine.ts` | Fan-out new probes in `Promise.all` |
| `src/lib/scan/analyze.ts` | Call `pushDeploymentHygieneChecks` |
| `src/lib/scan/verdict.ts` | P0: `exposed-env`, `exposed-git` |
| `src/lib/scan/prompts.ts` | Fix prompts for new check IDs |
| `src/lib/scan/brief.ts` | Embarrassment copy for exposed paths |
| `apps/preflight-mcp/src/index.ts` | Deploylint tools + gate P0 sync |
| `skills/deploylint/SKILL.md` | Agent skill for skills.sh |
| `src/routes/compare/+page.svelte` | Named competitors (Phase A) |

---

# PHASE C — Check depth (Phases 26–28)

### Task 1: Exposed path probe

**Files:**
- Create: `apps/preflight/src/lib/scan/probes.exposed.test.ts`
- Modify: `apps/preflight/src/lib/scan/constants.ts`
- Modify: `apps/preflight/src/lib/scan/probes.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/preflight/src/lib/scan/probes.exposed.test.ts
import { describe, it, expect, vi } from 'vitest';
import { probeExposedPaths } from './probes';

describe('probeExposedPaths', () => {
	it('flags .env when 200 with KEY= pattern', async () => {
		const fetchText = vi.fn(async (url: string) => {
			if (url.endsWith('/.env')) return 'DATABASE_URL=postgres://x\n';
			return null;
		});
		const headOk = vi.fn(async (url: string) => url.endsWith('/.env'));
		const base = new URL('https://app.example.com/');
		const r = await probeExposedPaths(base, headOk, fetchText);
		expect(r.env.exposed).toBe(true);
		expect(r.git.exposed).toBe(false);
	});

	it('passes when .env returns 404', async () => {
		const fetchText = vi.fn(async () => null);
		const headOk = vi.fn(async () => false);
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.env.exposed).toBe(false);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd apps/preflight && npx vitest run src/lib/scan/probes.exposed.test.ts`  
Expected: FAIL — `probeExposedPaths` not exported

- [ ] **Step 3: Add constant + implementation**

In `constants.ts`:

```typescript
export const MAX_EXPOSED_PATH_PROBES = 8;
export const EXPOSED_PATHS = [
	{ id: 'env', path: '/.env', patterns: [/^[A-Z0-9_]+=/m, /SECRET/i] },
	{ id: 'git', path: '/.git/HEAD', patterns: [/^ref:/m] },
	{ id: 'backup', path: '/backup.zip', patterns: [] },
	{ id: 'env-bak', path: '/.env.bak', patterns: [/^[A-Z0-9_]+=/m] },
	{ id: 'package', path: '/package.json', patterns: [/"name"\s*:/] }
] as const;
```

In `probes.ts` — add types + function:

```typescript
export type ExposedPathResult = {
	env: { exposed: boolean; url?: string };
	git: { exposed: boolean; url?: string };
	backup: { exposed: boolean; url?: string };
	packageJson: { exposed: boolean; url?: string };
};

export async function probeExposedPaths(
	finalUrl: URL,
	headOk: ScanDeps['headOk'],
	fetchText: ScanDeps['fetchText']
): Promise<ExposedPathResult> {
	const origin = finalUrl.origin;
	const result: ExposedPathResult = {
		env: { exposed: false },
		git: { exposed: false },
		backup: { exposed: false },
		packageJson: { exposed: false }
	};
	// For each path in EXPOSED_PATHS (slice MAX), HEAD then GET if ok
	// Set exposed=true when body matches patterns (or backup.zip content-type application/zip)
	return result;
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/scan/probes.exposed.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/preflight/src/lib/scan/probes.ts apps/preflight/src/lib/scan/probes.exposed.test.ts apps/preflight/src/lib/scan/constants.ts
git commit -m "feat(preflight): add read-only exposed path probes"
```

---

### Task 2: Health endpoint probe

**Files:**
- Create: `apps/preflight/src/lib/scan/probes.health.test.ts`
- Modify: `apps/preflight/src/lib/scan/probes.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { probeHealthEndpoints } from './probes';

it('finds first 2xx among common health paths', async () => {
	const headOk = vi.fn(async (url: string) => url.endsWith('/health'));
	const r = await probeHealthEndpoints(new URL('https://api.example.com/'), headOk);
	expect(r.found).toBe(true);
	expect(r.path).toBe('/health');
});
```

- [ ] **Step 2: Implement `probeHealthEndpoints`**

Paths: `/health`, `/healthz`, `/api/health`, `/status` — stop at first 2xx HEAD.

- [ ] **Step 3: Run tests + commit**

```bash
git commit -m "feat(preflight): probe health endpoints"
```

---

### Task 3: Deployment hygiene checks module

**Files:**
- Create: `apps/preflight/src/lib/scan/checks/deployment-hygiene.ts`
- Create: `apps/preflight/src/lib/scan/checks/deployment-hygiene.test.ts`
- Modify: `apps/preflight/src/lib/scan/checks/context.ts`
- Modify: `apps/preflight/src/lib/scan/analyze.ts`

- [ ] **Step 1: Extend ScanContext**

```typescript
// context.ts
import type { ExposedPathResult } from '$lib/scan/probes';
exposedPaths?: ExposedPathResult;
healthEndpoint?: { found: boolean; path?: string };
debugSignals?: { consoleLog: boolean; debuggerStmt: boolean; testIdCount: number };
```

- [ ] **Step 2: Write failing tests for `pushDeploymentHygieneChecks`**

Assert:
- `exposed-env` → fail when `exposedPaths.env.exposed`
- `exposed-git` → fail when git exposed
- `health-endpoint` → warn when stack has Stripe + no health
- `web-manifest` → warn when no `<link rel="manifest">` on PWA-like stack
- `debug-in-bundle` → warn when consoleLog in scripts

- [ ] **Step 3: Implement `pushDeploymentHygieneChecks`**

Use `makeCheck` + `fixPrompt` pattern from `competitive.ts`.

- [ ] **Step 4: Wire in `analyze.ts`** after competitive checks

- [ ] **Step 5: Run `npm run test -w preflight` + commit**

---

### Task 4: Engine integration + debug scan extension

**Files:**
- Modify: `apps/preflight/src/lib/scan/engine.ts`
- Modify: `apps/preflight/src/lib/scan/probes.ts` (`scanScripts` return debugSignals)
- Modify: `apps/preflight/src/lib/scan/verdict.ts`

- [ ] **Step 1: Add probes to engine `Promise.all`**

```typescript
const [..., exposedPaths, healthEndpoint] = await Promise.all([
	// existing...
	probeExposedPaths(finalUrl, deps.headOk, deps.fetchText),
	probeHealthEndpoints(finalUrl, deps.headOk)
]);
```

Pass into `scanCtx`.

- [ ] **Step 2: Add P0 IDs**

```typescript
// verdict.ts P0_IDS add:
'exposed-env',
'exposed-git',
```

- [ ] **Step 3: Extend `scanScripts` to return `debugSignals`**

Count `console.log(` and `debugger` in fetched script text (warn thresholds: ≥3 logs).

- [ ] **Step 4: Update `engine.test.ts` with mock exposed path**

- [ ] **Step 5: Run full verify**

Run: `npm run verify:preflight`  
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(preflight): wire deployment hygiene checks into scan engine"
```

---

### Task 5: Prompts, brief, marketing count

**Files:**
- Modify: `apps/preflight/src/lib/scan/prompts.ts`
- Modify: `apps/preflight/src/lib/scan/brief.ts`
- Modify: `apps/preflight/src/routes/+page.svelte`
- Modify: `apps/preflight/src/routes/compare/+page.svelte` (add rows only — full competitor table in Phase A)
- Modify: `apps/preflight/src/routes/llms.txt/+server.ts`

- [ ] **Step 1: Add fix prompts**

```typescript
'exposed-env': `${base}Your /.env file is publicly downloadable. Remove it from the web root immediately, rotate every secret that was in the file, and ensure env vars are injected at runtime (Wrangler secrets, Vercel env, etc.). Never serve dotenv files as static assets.`,
'exposed-git': `${base}The .git directory is exposed. An attacker can download your entire repository history. Block /.git in your CDN/reverse proxy (Cloudflare WAF rule, nginx location deny), redeploy, and rotate any secrets ever committed.`,
'health-endpoint': `${base}Add a lightweight health endpoint (GET /health returning 200 + {"ok":true}) for uptime monitoring and deploy gates.`,
'web-manifest': `${base}Add a web app manifest (public/manifest.webmanifest) and <link rel="manifest" href="/manifest.webmanifest"> for installability and PWA polish.`,
'debug-in-bundle': `${base}Remove console.log and debugger statements from production bundles. Enable build minification/strip or use esbuild drop:['console','debugger'].`,
```

- [ ] **Step 2: Add brief embarrassment lines in `brief.ts`**

- [ ] **Step 3: Count checks** — script or manual: `rg "makeCheck\\(|check\\(" apps/preflight/src/lib/scan | wc` — update homepage to **90+ checks**

- [ ] **Step 4: Add compare rows** for exposed paths, health, manifest

- [ ] **Step 5: Deploy + smoke**

Run: `npm run deploy:preflight && npm run smoke:phase23 -w preflight`

- [ ] **Step 6: Commit**

```bash
git commit -m "docs(preflight): 90+ checks marketing and prompts for deployment hygiene"
```

**Phase C complete when:** verify green, smoke green, ≥6 new check IDs live.

---

# PHASE B — Developer / CI wedge (Phases 29–31)

### Task 6: MCP Deploylint rebrand

**Files:**
- Modify: `apps/preflight-mcp/src/index.ts`
- Modify: `apps/preflight-mcp/package.json` (if name field exists)
- Create: `apps/preflight-mcp/src/index.test.ts` (gate P0 unit test)

- [ ] **Step 1: Write failing gate test**

```typescript
import { evaluateGate } from './gate'; // extract evaluateGate to testable module
const report = { verdict: 'no-go', score: 90, checks: [{ id: 'exposed-git', status: 'fail', title: 'x', message: 'y' }], ... };
expect(evaluateGate(report, 80).pass).toBe(false);
```

- [ ] **Step 2: Extract `evaluateGate` + sync P0 with `verdict.ts`**

Import `checkPriority` or share `P0_IDS` from a tiny `gate/p0.ts` shared package — **prefer duplicate list in MCP with comment "sync with verdict.ts"** to avoid cross-workspace import.

P0 gate set:

```typescript
const GATE_P0 = new Set([
	'reachable','fetch','https','secrets','privacy','noindex','robots-block',
	'form-security','env-committed','exposed-env','exposed-git'
]);
```

- [ ] **Step 3: Add tools**

```typescript
const apiBase = (process.env.DEPLOYLINT_API ?? process.env.PREFLIGHT_API ?? 'https://deploylint.com').replace(/\/$/, '');

server.tool('deploylint_scan', 'Run a Deploylint launch-readiness audit...', ...);
server.tool('deploylint_gate', 'PASS/FAIL deploy gate...', ...);
// Keep preflight_scan / preflight_gate as aliases calling same handlers
```

- [ ] **Step 4: Update server name to `deploylint`**

- [ ] **Step 5: Run MCP tests + commit**

---

### Task 7: Agent skill for skills.sh

**Files:**
- Create: `skills/deploylint/SKILL.md`
- Modify: `apps/preflight/src/routes/developers/+page.svelte`
- Modify: `apps/preflight/README.md`

- [ ] **Step 1: Write SKILL.md**

Sections:
- When to use Deploylint (pre-PR, pre-Product Hunt, post-deploy)
- MCP setup (`deploylint_scan`, `deploylint_gate`)
- Hosted gate: `curl -fsSL https://deploylint.com/gate-remote.mjs`
- Fix loop: unlock → master prompt → re-scan

- [ ] **Step 2: Link from /developers**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add Deploylint agent skill and developer docs"
```

---

### Task 8: CI gate polish

**Files:**
- Modify: `apps/preflight/scripts/gate-remote.mjs`
- Modify: `apps/preflight/src/routes/developers/+page.svelte`
- Modify: `apps/preflight/scripts/smoke-phase19.mjs`

- [ ] **Step 1: Add `--json` output to gate-remote** (optional flag)

```javascript
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ pass, score, verdict, reasons }));
  process.exit(pass ? 0 : 1);
}
```

- [ ] **Step 2: Update developers page** — `DEPLOYLINT_GATE_URL`, GitHub Action YAML example

- [ ] **Step 3: Extend smoke-phase19** — assert `deploylint` or `Deploylint` on developers page

- [ ] **Step 4: Run smoke:phase19 + commit**

**Phase B complete when:** MCP tools work against deploylint.com; smoke:phase19 green.

---

# PHASE A — Founder conversion (Phases 32–34)

### Task 9: Score delta + blocker diff UX

**Files:**
- Modify: `apps/preflight/src/lib/client/preflight-session.ts`
- Modify: `apps/preflight/src/lib/components/PostUnlockGuide.svelte`
- Create: `apps/preflight/src/lib/components/ScoreDeltaBadge.svelte`
- Modify: `apps/preflight/src/routes/+page.svelte`

- [ ] **Step 1: Store baseline checks in sessionStorage on first scan**

Key: `deploylint_baseline_checks` — array of `{id, status}`

- [ ] **Step 2: Compute `fixedBlockerCount` on re-scan**

Compare baseline fail/warn → current pass.

- [ ] **Step 3: Build `ScoreDeltaBadge.svelte`**

Show `72 → 89 (+17)` with green/red arrow.

- [ ] **Step 4: Wire into report header + PostUnlockGuide step 3**

- [ ] **Step 5: Vitest for diff logic** in `preflight-session.test.ts`

- [ ] **Step 6: Commit**

---

### Task 10: Named competitor compare page

**Files:**
- Modify: `apps/preflight/src/routes/compare/+page.svelte`

- [ ] **Step 1: Replace generic columns** with ShipReady, WebsiteReady, PageLens

Keep Lighthouse row as “different question” footnote.

- [ ] **Step 2: Add honesty notes** (Deploylint lacks screenshots — “partial”)

- [ ] **Step 3: SEO meta + commit**

---

### Task 11: Fix All prominence + funnel ops

**Files:**
- Modify: `apps/preflight/src/lib/components/UnlockComparePanel.svelte`
- Modify: `apps/preflight/src/lib/components/UnlockPanel.svelte`
- Modify: `docs/superpowers/workflow/preflight-loop-status.md`

- [ ] **Step 1: UnlockComparePanel** — add row “Fix all issues in one Cursor paste”

- [ ] **Step 2: Show master prompt first line blurred pre-unlock** (already redacted — show length: “47-line repair prompt”)

- [ ] **Step 3: Register Plausible** — document in loop-status (manual step)

- [ ] **Step 4: Run smoke:phase18 + deploy**

**Phase A complete when:** delta badge visible after re-scan; compare page names competitors; funnel doc updated.

---

## Final verification

- [ ] `npm run verify:preflight`
- [ ] `npm run smoke -w preflight`
- [ ] Manual: scan → unlock (when Stripe live) → re-scan → see delta badge

---

## Spec coverage self-review

| Spec section | Task |
|--------------|------|
| C1 exposed paths | Task 1, 3, 4 |
| C2 health | Task 2, 3, 4 |
| C3 manifest | Task 3 |
| C4 debug bundles | Task 3, 4 |
| C5 DKIM | Deferred — add in Task 3 if time; else Phase 28b |
| C6 marketing | Task 5 |
| B1 MCP | Task 6 |
| B2 skill | Task 7 |
| B3 CI | Task 8 |
| A1 proof UX | Task 9 |
| A2 compare | Task 10 |
| A3 Fix All | Task 11 |
| A4 funnel ops | Task 11 |

**Deferred:** DKIM probe (C5) — add as Task 3b between Task 3 and 4 if email auth already touched in same PR.
