# Deploylint Check Catalog Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand catalog coverage to the most important checks and expose the catalog as a public `/checks` page.

**Architecture:** Keep explanatory check metadata in `catalog.ts`, priority rules in `verdict.ts`, and page grouping in a small tested `catalog-view.ts` helper. The Svelte route renders the helper output without hardcoding catalog data.

**Tech Stack:** SvelteKit, TypeScript, Vitest, existing Deploylint page SEO pattern.

---

### Task 1: Expand Catalog Coverage

**Files:**

- Modify: `apps/preflight/src/lib/scan/catalog.ts`
- Modify: `apps/preflight/src/lib/scan/catalog.test.ts`

- [x] **Step 1: Write failing coverage tests**

Require catalog entries for every `P0_CHECK_IDS` item and all security-header checks.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -w preflight -- src/lib/scan/catalog.test.ts`

Expected: FAIL on missing `reachable` and `hsts-header`.

- [x] **Step 3: Add missing entries**

Document P0 blockers and security headers with `why`, `detectedBy`, and `falsePositive` guidance.

- [x] **Step 4: Run catalog test**

Run: `npm.cmd run test -w preflight -- src/lib/scan/catalog.test.ts`

Expected: PASS.

### Task 2: Catalog View Helper

**Files:**

- Create: `apps/preflight/src/lib/scan/catalog-view.ts`
- Test: `apps/preflight/src/lib/scan/catalog-view.test.ts`

- [x] **Step 1: Write failing helper tests**

Cover priority grouping, empty group omission, and readable title formatting.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -w preflight -- src/lib/scan/catalog-view.test.ts`

Expected: FAIL because the helper module does not exist.

- [x] **Step 3: Implement helper**

Use `checkPriority()` from `verdict.ts` and return P0/P1/P2 groups with readable labels.

- [x] **Step 4: Run focused tests**

Run: `npm.cmd run test -w preflight -- src/lib/scan/catalog.test.ts src/lib/scan/catalog-view.test.ts`

Expected: PASS.

### Task 3: Public Checks Page

**Files:**

- Create: `apps/preflight/src/routes/checks/+page.server.ts`
- Create: `apps/preflight/src/routes/checks/+page.svelte`
- Modify: `apps/preflight/src/routes/+layout.svelte`

- [x] **Step 1: Add static server load**

Follow compare/developers page pattern and return `appUrl` for canonical SEO metadata.

- [x] **Step 2: Render catalog groups**

Render each group with check id, generated title, why, detection, and false-positive guidance.

- [x] **Step 3: Add navigation**

Add `Checks` to the top nav and footer.

- [x] **Step 4: Clean separator encoding**

Replace mojibake separators in touched nav/footer text with `&middot;`.

### Task 4: Verification

- [x] **Step 1: Run type check**

Run: `npm.cmd run check -w preflight`

Expected: `svelte-check found 0 errors and 0 warnings`.

- [x] **Step 2: Run full verifier**

Run: `npm.cmd run verify:preflight`

Expected: check, lint, tests, and build pass.
