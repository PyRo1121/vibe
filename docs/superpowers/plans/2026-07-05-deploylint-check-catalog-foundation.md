# Deploylint Check Catalog Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start a single source of truth for check explanations so report UI, GitHub output, and MCP resources can reuse the same “why it matters,” detection, and false-positive guidance.

**Architecture:** Add a pure TypeScript catalog module keyed by check id. Keep priority rules in `verdict.ts`; the catalog only owns explanatory metadata. The Findings UI reads catalog entries opportunistically, so uncataloged checks keep rendering normally.

**Tech Stack:** SvelteKit, TypeScript, Vitest, existing Deploylint scan/report components.

---

### Task 1: Catalog Module

**Files:**

- Create: `apps/preflight/src/lib/scan/catalog.ts`
- Test: `apps/preflight/src/lib/scan/catalog.test.ts`

- [x] **Step 1: Write failing catalog tests**

Cover service-aware checks, high-risk security/deployment checks, unique ids, and unknown-id fallback.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -w preflight -- src/lib/scan/catalog.test.ts`

Expected: FAIL because `./catalog` does not exist.

- [x] **Step 3: Add catalog implementation**

Create `CHECK_CATALOG`, `getCheckCatalogEntry(id)`, and `catalogEntries()`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm.cmd run test -w preflight -- src/lib/scan/catalog.test.ts`

Expected: PASS.

### Task 2: Findings UI Integration

**Files:**

- Modify: `apps/preflight/src/lib/components/Checklist.svelte`

- [x] **Step 1: Wire catalog lookup into findings cards**

For each non-passing finding, call `getCheckCatalogEntry(item.id)`.

- [x] **Step 2: Render compact explanation blocks**

Show “Why this matters,” “Detection,” and optional “Might be okay if” only when a catalog entry exists.

- [x] **Step 3: Run Svelte type check**

Run: `npm.cmd run check -w preflight`

Expected: `svelte-check found 0 errors and 0 warnings`.

### Task 3: Verification

- [x] **Step 1: Run focused tests**

Run: `npm.cmd run test -w preflight -- src/lib/scan/catalog.test.ts`

Expected: PASS.

- [x] **Step 2: Run full verifier**

Run: `npm.cmd run verify:preflight`

Expected: check, lint, tests, and build pass.

### Next Pack

Extend catalog coverage in small batches:

- P0 launch blockers.
- Security headers and exposed-surface checks.
- SEO/social preview checks.
- Repo CVE/license/CI checks.

Then expose `catalogEntries()` as an internal check catalog page or MCP resource.
