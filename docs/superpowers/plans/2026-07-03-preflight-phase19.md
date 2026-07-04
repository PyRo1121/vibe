# Phase 19 — CI Deploy Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Productize the deploy gate so builders can block bad ships in CI without installing the monorepo.

**Architecture:** Reuse existing `/api/scan` + `evaluateGate` rules. Ship a zero-dependency Node script at `/gate-remote.mjs` for any repo. Document monorepo workflow, hosted script, and MCP on `/developers`.

**Tech Stack:** SvelteKit 5, Cloudflare static assets, Node gate-remote.mjs, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-07-03-preflight-phase19-design.md`

---

### Task 1: Standalone gate-remote script

**Files:**
- Create: `apps/preflight/scripts/gate-remote.mjs`
- Create: `apps/preflight/static/gate-remote.mjs` (same content — served at `/gate-remote.mjs`)

- [ ] **Step 1:** Implement fetch → evaluate → exit 0/1 (mirror `evaluate.ts` P0 rules)
- [ ] **Step 2:** Env: `PREFLIGHT_URL`, `PREFLIGHT_API`, `PREFLIGHT_MIN_SCORE`

### Task 2: Developers page

**Files:**
- Create: `apps/preflight/src/routes/developers/+page.server.ts`
- Create: `apps/preflight/src/routes/developers/+page.svelte`
- Modify: `apps/preflight/src/routes/+layout.svelte` (nav + footer link)
- Modify: `apps/preflight/src/routes/+page.svelte` (pre-scan CI teaser)

- [ ] **Step 1:** Copy-paste blocks for hosted script, GitHub Action, local monorepo gate, MCP
- [ ] **Step 2:** svelte-autofixer clean

### Task 3: Smoke + ship

**Files:**
- Create: `apps/preflight/scripts/smoke-phase19.mjs`
- Modify: `apps/preflight/package.json`, root `package.json`
- Modify: `apps/preflight/src/routes/llms.txt/+server.ts`
- Modify: `docs/superpowers/workflow/preflight-loop-status.md`

- [ ] **Step 1:** smoke checks `/developers`, `/gate-remote.mjs`, homepage link, llms.txt
- [ ] **Step 2:** `npm run verify:preflight` → `npm run deploy:preflight` → smoke on prod
