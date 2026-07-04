# Deploylint superiority roadmap — C → B → A

**Status:** Approved priority order (2026-07-04)  
**Host:** https://lint.latham.cloud  
**Goal:** Close competitor check-depth gaps, strengthen developer distribution, then optimize founder conversion — without abandoning the launch-judgment wedge.

---

## Strategic anchor (do not drift)

Deploylint wins on **launch judgment → embarrassment prevention → fix in Cursor → prove with re-scan**.

Competitors to beat on depth: **ShipReady** (151 checks), **preflight.sh** (CLI + services), **Preflyt** (exposed surfaces), **WebsiteReady** (GO/NO-GO + prompts).

We do **not** become Lighthouse or PageLens vision-AI in this roadmap.

---

## Phase C — Check depth (Phases 26–28)

**Objective:** Reach **90+ marketed checks** with high-signal probes competitors cite, especially Preflyt-style exposed surfaces and preflight.sh hygiene.

### C1 — Exposed surface probes (Preflyt parity, read-only)

Same-origin bounded HEAD/GET probes (max 8 paths, no port scanning):

| Path | Check ID | Priority if exposed |
|------|----------|---------------------|
| `/.env` | `exposed-env` | P0 |
| `/.git/HEAD` | `exposed-git` | P0 |
| `/backup.zip`, `/.env.bak`, `/db.sql` | `exposed-backup` | P1 |
| `/package.json` (root) | `exposed-package` | P2 warn |

**Rules:** Only fail when response is 200 and body matches sensitivity heuristics (env keys, `ref:`, SQL dump markers). 403/404 = pass.

### C2 — Health & ops endpoints (preflight.sh parity)

Probe common paths in parallel: `/health`, `/healthz`, `/api/health`, `/status`.

| Check ID | Priority | Logic |
|----------|----------|-------|
| `health-endpoint` | P2 | Warn if SaaS-like stack (Stripe/Supabase/auth UI) and no endpoint returns 2xx |

### C3 — PWA / manifest (preflight.sh parity)

| Check ID | Priority | Logic |
|----------|----------|-------|
| `web-manifest` | P2 | Warn if `<link rel="manifest">` missing for installable stacks; pass/fail manifest fetch if linked |

### C4 — Production debug hygiene

Extend `scanScripts()` text audit:

| Check ID | Priority | Logic |
|----------|----------|-------|
| `debug-in-bundle` | P2 | Warn on `console.log(`, `debugger`, `data-testid=` density in production bundles |

### C5 — Email auth depth

Extend `checkEmailAuth`:

| Check ID | Priority | Logic |
|----------|----------|-------|
| `dkim-dns` | P2 | Warn if SPF present but no DKIM selector at common `_domainkey` patterns |

### C6 — Marketing & compare honesty

- Homepage: **“90+ checks”** (count after implementation)
- `/compare`: add rows for exposed surfaces, health endpoint, web manifest
- `llms.txt` + README updated

**Exit criteria (Phase C):** New unit tests per check module; `engine.test.ts` integration; smoke unchanged or extended; check count ≥ 90 unique IDs.

---

## Phase B — Developer / CI wedge (Phases 29–31)

**Objective:** Match **preflight.sh** agent discoverability and beat ShipReady on CI integration.

### B1 — MCP rebrand (backward compatible)

| Change | Detail |
|--------|--------|
| Server name | `deploylint` |
| Tools | `deploylint_scan`, `deploylint_gate` |
| Aliases | Keep `preflight_scan`, `preflight_gate` deprecated for 1 release |
| Default API | `DEPLOYLINT_API` → `https://lint.latham.cloud`; fallback `PREFLIGHT_API` |
| Gate P0 set | Sync with `verdict.ts`: add `noindex`, `robots-block`, `form-security`, `exposed-env`, `exposed-git` |

### B2 — Agent skill (skills.sh)

Publish `skills/deploylint/SKILL.md`:

- When to scan (pre-PR, pre-PH, post-deploy)
- How to call MCP or `gate-remote.mjs`
- Fix loop: scan → prompts → deploy → re-scan

### B3 — CI product polish

- `/developers`: GitHub Action snippet with `DEPLOYLINT_GATE_URL`
- `gate-remote.mjs`: include new P0 IDs in failure output
- `smoke:phase19`: assert new check IDs documented on developers page
- Optional: `--json` flag on gate-remote for Actions

### B4 — Internal consistency

- `USER_AGENT` already Deploylint — keep
- Worker name stays `preflight` until domain migration (no infra change in B)

**Exit criteria (Phase B):** MCP tests; smoke:phase19 green; skill file in repo; developers docs reference Deploylint naming.

---

## Phase A — Founder conversion (Phases 32–34)

**Objective:** Win unlocks and re-scans vs ShipReady/PageLens after depth + CI are solid.

### A1 — Post-unlock proof UX

- **Score delta badge** on re-scan (before/after, Δ points)
- **“Fixed N of M blockers”** from check status diff vs sessionStorage baseline
- `PostUnlockGuide.svelte`: 3-step loop with progress ring
- Permalink `/r/[id]`: show delta when `scoreDelta` present

### A2 — Named competitor compare

Replace generic columns with:

| | Deploylint | ShipReady | WebsiteReady | PageLens |
|---|:---:|:---:|:---:|:---:|
| Embarrassment brief | ✓ | — | — | — |
| Re-scan score proof | ✓ | partial | partial | ✓ |
| Exposed .env/.git probe | ✓ | partial | — | — |
| CI gate + MCP | ✓ | — | — | — |
| Screenshots | — | partial | — | ✓ |

Honest partials — builds trust.

### A3 — Fix All prominence

- Pre-unlock: show blurred master prompt preview + “9 fixes in one paste”
- `UnlockComparePanel`: headline “Fix everything in one Cursor paste”
- Sample prompt on homepage uses highest-P0 issue

### A4 — Funnel ops

- Plausible on `lint.latham.cloud`
- Phase 18 metrics watch (30–45 days)
- Stripe live once `charges_enabled`

**Exit criteria (Phase A):** Funnel events `rescan_completed` with delta; compare page smoke; manual unlock→re-scan path documented.

---

## Sequencing summary

```
Phase 26–28 (C)  Check depth probes + marketing count
       ↓
Phase 29–31 (B)  MCP + skill + CI gate sync
       ↓
Phase 32–34 (A)  Unlock proof UX + compare + Fix All
```

---

## Non-goals (this roadmap)

- Headless Chrome / vision AI (PageLens parity) — defer Tier 3 evidence layer
- Weekly monitoring subscription — defer until wedge metrics prove
- Monorepo rename `apps/preflight` → `apps/deploylint` — defer until `deploylint.com`
- Port scanning (Preflyt full suite) — security/legal risk on Workers

---

## Success metrics

| Horizon | Signal |
|---------|--------|
| 2 weeks | Check count ≥ 90; smoke green; exposed-path tests pass |
| 4 weeks | MCP + skill published; gate blocks new P0s |
| 8 weeks | Unlock → re-scan rate ↑; compare page traffic; 1+ PH/Reddit share with delta badge |
