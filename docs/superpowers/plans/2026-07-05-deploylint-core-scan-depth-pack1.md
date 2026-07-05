# Deploylint Core Scan Depth Pack 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first research-backed scan-depth improvements in the order a developer needs them: service detection, service-aware launch checks, and operational readiness signals.

**Architecture:** Extend existing parser and check-builder modules instead of adding a second scanner. `parse.ts` owns conservative service signatures, `stack.ts` owns visible stack chips, and `checks/stack-services.ts` turns detected services into actionable report checks.

**Tech Stack:** SvelteKit, TypeScript, Vitest, existing Deploylint scan pipeline.

---

### Task 1: Expand Service Detection

**Files:**

- Modify: `apps/preflight/src/lib/scan/parse.ts`
- Modify: `apps/preflight/src/lib/scan/stack.ts`
- Test: `apps/preflight/src/lib/scan/stack.test.ts`

- [x] **Step 1: Write failing stack-chip tests**

Add a test proving Paddle, Lemon Squeezy, Sentry, Clerk, and OpenAI are detected from script/API signatures.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -w preflight -- src/lib/scan/stack.test.ts`

- [x] **Step 3: Add conservative signatures**

Add signature booleans to `mentionsStack()` and matching visible labels to `detectStack()`.

- [x] **Step 4: Run focused tests**

Run: `npm.cmd run test -w preflight -- src/lib/scan/stack.test.ts src/lib/scan/parse.test.ts`

### Task 2: Add Service-Aware Checks

**Files:**

- Modify: `apps/preflight/src/lib/scan/checks/stack-services.ts`
- Modify: `apps/preflight/src/lib/scan/prompts.ts`
- Test: `apps/preflight/src/lib/scan/checks/stack-services.test.ts`

- [x] **Step 1: Write failing service-check tests**

Cover payment checks for Paddle/Lemon Squeezy, auth provider review, error monitoring positive signal, and client-side AI API warnings.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -w preflight -- src/lib/scan/checks/stack-services.test.ts`

- [x] **Step 3: Implement checks and prompts**

Aggregate stack signals across crawled pages and emit actionable checks with specific fix prompts.

- [x] **Step 4: Run focused tests**

Run: `npm.cmd run test -w preflight -- src/lib/scan/checks/stack-services.test.ts`

### Task 3: Broaden Health Readiness

**Files:**

- Modify: `apps/preflight/src/lib/scan/checks/deployment-hygiene.ts`
- Test: `apps/preflight/src/lib/scan/checks/deployment-hygiene.test.ts`
- Test: `apps/preflight/src/lib/scan/checks/meta.test.ts`

- [x] **Step 1: Write failing auth-backed health test**

Prove a Clerk-backed app without a common health endpoint gets a `health-endpoint` warning.

- [x] **Step 2: Run test to verify it fails**

Run: `npm.cmd run test -w preflight -- src/lib/scan/checks/deployment-hygiene.test.ts`

- [x] **Step 3: Broaden SaaS-like readiness condition**

Include payment, auth, backend, and AI provider signals in the health-endpoint expectation.

- [x] **Step 4: Remove duplicated stack fixture shape**

Use `parsePageMeta()` in `meta.test.ts` so parser output changes do not require hand-updating every stack boolean.

### Task 4: Verification

**Files:**

- Verify all changed scan modules.

- [x] **Step 1: Run clean focused tests**

Run: `npm.cmd run test -w preflight -- src/lib/scan/checks/stack-services.test.ts src/lib/scan/stack.test.ts src/lib/scan/checks/deployment-hygiene.test.ts src/lib/scan/checks/meta.test.ts src/lib/scan/parse.test.ts`

Expected: all selected test files pass.

- [x] **Step 2: Run package check**

Run: `npm.cmd run check -w preflight`

Expected: `svelte-check found 0 errors and 0 warnings`.

- [x] **Step 3: Run full verifier**

Run: `npm.cmd run verify:preflight`

Expected: check, lint, tests, and build pass.

### Next Pack

After Pack 1 verifies, implement the check catalog foundation:

- Add a shared catalog file for check metadata.
- Start with the new service checks and high-risk deployment checks.
- Use catalog entries to power report explanations and future MCP resources.
