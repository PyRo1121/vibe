# Launchlint rebrand — design spec

**Status:** Draft — awaiting review  
**Date:** 2026-07-04  
**Replaces:** “Preflight” working title on `preflight.latham.cloud`

---

## Decision

| Field | Choice |
|-------|--------|
| **Product name** | **Launchlint** |
| **Primary domain** | `launchlint.com` |
| **Secondary domain** | `launchlint.dev` (docs, CLI landing, developer redirects) |
| **Tone** | Builder-native — linter for launches, not a Lighthouse competitor |
| **Hero (unchanged)** | *Should you post this URL today?* |
| **Category line** | *Lint your launch before the internet does.* |

### Why Launchlint

- **Distinct wedge:** launch judgment + embarrassment prevention + fix-and-prove — not perf scores.
- **Builder-native:** reads like ESLint/Ruff; natural CLI (`launchlint gate`), CI gate, MCP naming.
- **DNS signal (2026-07-04):** `launchlint.com` and `launchlint.dev` returned no DNS — likely registrable (confirm at purchase).
- **Avoids conflicts:** `postgate`, `shipgate`, `linklint`, `gonogo.dev` taken or crowded.

---

## Brand system

### Naming rules

| Context | Form |
|---------|------|
| Product / marketing | **Launchlint** (capital L) |
| CLI / package / repo paths | `launchlint` (lowercase) |
| Env vars | `PUBLIC_SITE_NAME=Launchlint`, `PUBLIC_APP_URL=https://launchlint.com` |
| User-agent | `Launchlint/1.0 (+https://launchlint.com; site-readiness-audit)` |
| Stripe product | `Launchlint Fix & Verify` |
| Paid tier label | **Launchlint Fix** — $9 per URL |
| Support email | `support@launchlint.com` |

### Voice

- Direct, technical, no hype.
- Verdict-first: GO / NO-GO / FIX FIRST.
- “Lint” = deterministic checks; “Fix” = paid Cursor prompts + re-scan delta.

### Visual (implementation later)

- Lowercase wordmark, monospace or geometric sans (Geist already in stack).
- Keep dark mesh + sky accent — re-skin logo/og.svg only.
- Lint metaphor in UI: check output styled like tool diagnostics (optional Phase 2 polish).

---

## Domains — register before code rebrand

| Domain | Role |
|--------|------|
| `launchlint.com` | Production app, marketing, Stripe webhook URL |
| `launchlint.dev` | Redirect to `/developers` or docs; optional CLI install page |

**Registrar checklist (ops, not code):**

1. Register both domains.
2. Point `launchlint.com` → Cloudflare (same account as current Worker).
3. Keep `preflight.latham.cloud` live during transition (301 later).
4. Set up `support@launchlint.com` (Cloudflare Email Routing or existing provider).

---

## Migration strategy (phased)

Do **not** rename the monorepo package `apps/preflight` in Phase A — too much churn for zero user value. Rename user-facing surfaces first; internal package rename is optional Phase C.

### Phase A — User-facing rebrand (ship first)

**Goal:** Production reads as Launchlint; same codebase paths.

| Area | Change |
|------|--------|
| `PUBLIC_SITE_NAME`, `PUBLIC_APP_URL`, `PUBLIC_PLAUSIBLE_DOMAIN` | Launchlint / launchlint.com |
| `wrangler.jsonc` routes | Add `launchlint.com` custom domain; keep `preflight.latham.cloud` |
| All Svelte pages | Titles, meta, JSON-LD, footer, legal copy |
| `static/sitemap.xml`, `robots.txt`, `llms.txt` | New URLs |
| `USER_AGENT` in scan constants | Launchlint |
| Stripe checkout product name | Launchlint Fix & Verify |
| Smoke scripts `PREFLIGHT_BASE` | Rename env to `LAUNCHLINT_BASE` (keep alias 1 release) |
| `gate-remote.mjs`, `/developers`, `/compare` | Launchlint branding |
| Docs: `preflight-loop-status.md` → `launchlint-loop-status.md` (or section rename) |
| Root `package.json` scripts | Add `deploy:launchlint` aliases; deprecate `:preflight` gradually |

**Success criteria:** `npm run verify:preflight` green; smoke passes on `launchlint.com`; OG tags show Launchlint.

### Phase B — Infrastructure aliases

| Area | Change |
|------|--------|
| Cloudflare Worker | Keep internal name `preflight` OR rename to `launchlint` (requires new Worker + binding migration) |
| KV namespace | Keep `REPORTS` binding ID — no data migration |
| SELF binding | Update if Worker renamed |
| GitHub Action / gate docs | `PREFLIGHT_GATE_URL` → `LAUNCHLINT_GATE_URL` (document both) |
| MCP server `preflight-mcp` | Rename tools to `launchlint_scan`, `launchlint_gate` |
| `.cursor/mcp.json` | Update server + tool names |

### Phase C — Monorepo rename (optional, low priority)

| From | To |
|------|-----|
| `apps/preflight` | `apps/launchlint` |
| `apps/preflight-mcp` | `apps/launchlint-mcp` |
| npm workspace `preflight` | `launchlint` |
| Turbo filter `--filter=preflight` | `--filter=launchlint` |
| `.github/workflows/preflight-gate.yml` | `launchlint-gate.yml` |

Defer until Phase A+B stable — grep shows 50+ files reference `preflight`.

### Phase D — Sunset

- 301 `preflight.latham.cloud` → `launchlint.com` (6–12 months).
- Remove `PREFLIGHT_*` env aliases.
- Archive old docs paths.

---

## Redirect & SEO

- `canonical` → `https://launchlint.com/`
- `preflight.latham.cloud` → 301 all paths (after 2 weeks dual-host).
- Update Product Hunt / X / GitHub links when domain is live.
- Plausible: new property `launchlint.com` (Phase 18 ops).

---

## What stays the same

- Product wedge, pricing ($9/url), scan engine, KV unlock, gate CLI behavior.
- Repo root name `vibe` (monorepo) — no change.
- `tcg-vault` app — unrelated.

---

## Implementation plan (next session)

After this spec is approved:

1. Invoke **writing-plans** skill → `docs/superpowers/plans/2026-07-04-launchlint-rebrand.md`
2. Execute Phase A in one PR: env, wrangler domain, copy sweep, smoke env rename.
3. User registers domains in parallel.
4. Deploy to `launchlint.com`; run full smoke.
5. Phase B (MCP + gate env) as follow-up PR.

**Out of scope for rebrand PR:** logo redesign, monorepo folder rename, tcg-vault references.

---

## Open questions for owner

1. **Worker rename** — keep Cloudflare Worker name `preflight` internally, or migrate to `launchlint`? (Recommend: keep `preflight` in Phase A to avoid binding churn.)
2. **Email** — `support@launchlint.com` via Cloudflare Email Routing?
3. **Social handles** — register `@launchlint` on X/GitHub org now?

---

## Approval

- [ ] Name **Launchlint** confirmed
- [ ] Domains to register: `launchlint.com`, `launchlint.dev`
- [ ] Phase A-first migration approved
- [ ] Ready for implementation plan
