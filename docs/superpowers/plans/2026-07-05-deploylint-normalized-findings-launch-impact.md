# Deploylint Normalized Findings And Launch Impact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repo-internal normalized finding model with launch-impact metadata, then use it for the first high-signal CI and billing-readiness checks while preserving the existing public `ScanReport` shape.

**Architecture:** Keep `ScanCheck` unchanged at the public report boundary. Add `repo/findings.ts` as the internal normalization, merge, and launch-impact layer, then have `repo/readiness.ts` produce enriched findings through that layer. Keep all new checks static and Worker-safe; no dependency install, no arbitrary command execution, and no private repo assumptions.

**Tech Stack:** SvelteKit, TypeScript, Vitest, existing Deploylint repo scanner, existing `ScanCheck` report contract.

---

## File Map

- Create: `apps/preflight/src/lib/scan/repo/findings.ts`
  - Owns `RepoFinding`, `RepoFindingEngine`, `RepoFindingLaunchImpact`, `RepoFindingConfidence`, normalization defaults, severity comparison, merge, and launch-impact helpers.
- Create: `apps/preflight/src/lib/scan/repo/findings.test.ts`
  - Verifies launch-impact defaults, explicit overrides, metadata defaults, and merge behavior.
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
  - Replaces the local `RepoReadinessFinding` shape with the normalized finding type.
  - Adds static CI checks for dependency review, Dependabot/Renovate, unsafe `actions/checkout` opt-out, and more precise `pull_request_target` behavior.
  - Adds static billing-readiness checks for Stripe-like checkout, webhook signature verification, and customer portal/billing management.
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`
  - Adds failing tests first for normalized metadata, new CI checks, and billing checks.
- Modify: `apps/preflight/src/lib/scan/repo/scan.ts`
  - Uses `mergeRepoFindings` instead of local merge helpers.
  - Fetches source samples into `RepoFileEvidence` for billing-readiness static checks.
  - Keeps conversion to `ScanCheck` unchanged for UI, MCP, gate, and API compatibility.
- Modify: `apps/preflight/src/lib/scan/repo/scan.test.ts`
  - Verifies new static checks surface in the report and do not duplicate check IDs.

## Task 1: Normalized Repo Finding Model

**Files:**
- Create: `apps/preflight/src/lib/scan/repo/findings.test.ts`
- Create: `apps/preflight/src/lib/scan/repo/findings.ts`

- [ ] **Step 1: Write failing tests for finding normalization**

Add tests:

```ts
import { describe, expect, it } from 'vitest';
import {
	mergeRepoFindings,
	normalizeRepoFinding,
	type RepoFinding
} from './findings';

describe('repo findings', () => {
	it('adds stable default metadata to static findings', () => {
		const finding = normalizeRepoFinding({
			id: 'ci-runs-quality-gates',
			category: 'launch',
			title: 'CI quality gates',
			status: 'warn',
			message: 'GitHub Actions workflow is missing quality gates: test.'
		});

		expect(finding).toMatchObject({
			id: 'ci-runs-quality-gates',
			ruleId: 'ci-runs-quality-gates',
			engine: 'deploylint-static',
			confidence: 'high',
			launchImpact: 'fix-soon'
		});
		expect(finding.fingerprint).toBe('deploylint-static:ci-runs-quality-gates');
	});

	it('treats known blocker failures as launch blockers', () => {
		const finding = normalizeRepoFinding({
			id: 'webhook-signature-missing',
			category: 'payments',
			title: 'Webhook signature verification',
			status: 'fail',
			message: 'Stripe webhook handler does not verify signatures.'
		});

		expect(finding.launchImpact).toBe('blocker');
	});

	it('keeps explicit launch-impact overrides', () => {
		const finding = normalizeRepoFinding({
			id: 'dependency-review-action',
			category: 'security',
			title: 'Dependency review action',
			status: 'warn',
			message: 'No dependency review action found.',
			launchImpact: 'watch'
		});

		expect(finding.launchImpact).toBe('watch');
	});

	it('merges duplicate findings by severity and launch impact', () => {
		const findings: RepoFinding[] = [
			normalizeRepoFinding({
				id: 'workflow-pull-request-target',
				category: 'security',
				title: 'pull_request_target safety',
				status: 'warn',
				message: 'Review pull_request_target usage.'
			}),
			normalizeRepoFinding({
				id: 'workflow-pull-request-target',
				category: 'security',
				title: 'pull_request_target safety',
				status: 'fail',
				message: 'pull_request_target checks out untrusted fork code.',
				launchImpact: 'blocker'
			})
		];

		expect(mergeRepoFindings(findings)).toEqual([expect.objectContaining({
			id: 'workflow-pull-request-target',
			status: 'fail',
			launchImpact: 'blocker'
		})]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/findings.test.ts
```

Expected: fail because `./findings` does not exist.

- [ ] **Step 3: Add the normalized finding implementation**

Create `findings.ts` with these exported APIs:

```ts
import type { ScanCheck } from '$lib/scan/types';

export type RepoFindingEngine =
	| 'deploylint-static'
	| 'osv-api'
	| 'osv-scanner'
	| 'zizmor'
	| 'trivy'
	| 'semgrep'
	| 'scorecard'
	| 'sbom'
	| 'sarif-export';

export type RepoFindingConfidence = 'high' | 'medium' | 'low';
export type RepoFindingLaunchImpact = 'blocker' | 'fix-soon' | 'watch';

export interface RepoFindingEvidence {
	path?: string;
	snippet?: string;
}

export interface RepoFindingReference {
	label: string;
	url: string;
}

export interface RepoFinding {
	id: string;
	ruleId: string;
	category: ScanCheck['category'];
	title: string;
	status: ScanCheck['status'];
	message: string;
	engine: RepoFindingEngine;
	confidence: RepoFindingConfidence;
	launchImpact: RepoFindingLaunchImpact;
	evidence?: RepoFindingEvidence;
	references: RepoFindingReference[];
	fixPromptId: string;
	fingerprint: string;
}
```

Implement `normalizeRepoFinding(input)`, `mergeRepoFindings(findings)`, and `defaultLaunchImpact(input)`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/findings.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git add apps/preflight/src/lib/scan/repo/findings.ts apps/preflight/src/lib/scan/repo/findings.test.ts
git commit -m "feat: add repo finding model"
```

## Task 2: Wire Readiness Findings Through The Model

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.ts`

- [ ] **Step 1: Write failing tests for readiness metadata**

Add assertions to the existing package script test:

```ts
expect(findings.find((finding) => finding.id === 'package-scripts')).toMatchObject({
	engine: 'deploylint-static',
	confidence: 'high',
	launchImpact: 'watch',
	ruleId: 'package-scripts',
	fixPromptId: 'package-scripts'
});
```

Add a merge behavior assertion in `scan.test.ts` after `report.checks` is built:

```ts
expect(report.checks.map((check) => check.id)).toHaveLength(
	new Set(report.checks.map((check) => check.id)).size
);
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts src/lib/scan/repo/scan.test.ts
```

Expected: fail because readiness findings do not expose normalized metadata yet.

- [ ] **Step 3: Update readiness and scan merge wiring**

In `readiness.ts`, import normalized finding APIs:

```ts
import { normalizeRepoFinding, type RepoFinding } from '$lib/scan/repo/findings';
```

Change `RepoReadinessFinding` to:

```ts
export type RepoReadinessFinding = RepoFinding;
```

Change the local `finding(...)` helper to return `normalizeRepoFinding({ ... })`.

In `scan.ts`, import `mergeRepoFindings` from `repo/findings`, use it in `repoReadinessChecks`, and remove the local `findingSeverity` and `mergeReadinessFindings` helpers.

- [ ] **Step 4: Run tests to verify pass**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/findings.test.ts src/lib/scan/repo/readiness.test.ts src/lib/scan/repo/scan.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts apps/preflight/src/lib/scan/repo/scan.ts
git commit -m "refactor: normalize repo readiness findings"
```

## Task 3: Add CI And Dependency Governance Checks

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`

- [ ] **Step 1: Write failing tests for CI governance**

Add tests proving:

- `dependency-review-action` passes when a workflow uses `actions/dependency-review-action@v4`.
- `dependency-review-action` warns when no dependency review action exists.
- `dependabot-config` passes when `.github/dependabot.yml` or `renovate.json` exists.
- `workflow-pull-request-target` fails when `pull_request_target` uses `actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}` or an unsafe opt-out such as `persist-credentials: true` combined with fork checkout.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: fail because the new checks do not exist.

- [ ] **Step 3: Implement CI governance checks**

Update `findStaticConfigPaths` in `scan.ts` to fetch:

```ts
/^\.github\/dependabot\.ya?ml$/,
/(^|\/)renovate\.json5?$/,
/(^|\/)\.renovaterc(\.json)?$/
```

Add helpers in `readiness.ts` for dependency review action detection, dependency update config detection, and unsafe pull-request-target checkout detection. Return new findings from `analyzeCiWorkflows`.

- [ ] **Step 4: Run tests to verify pass**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts src/lib/scan/repo/scan.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts apps/preflight/src/lib/scan/repo/scan.ts
git commit -m "feat: add repo CI governance checks"
```

## Task 4: Add Billing Readiness Static Checks

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.test.ts`

- [ ] **Step 1: Write failing tests for billing readiness**

Add tests proving:

- `webhook-signature-missing` fails when source files include Stripe webhook handling without signature verification.
- `webhook-signature-missing` passes when source files include `stripe.webhooks.constructEvent` or equivalent signature verification.
- `billing-portal` warns when Stripe subscription/checkout code exists but no customer portal/billing-management signal exists.
- `billing-portal` passes when source code includes `billingPortal.sessions.create`, `customer portal`, or an account billing route.

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts src/lib/scan/repo/scan.test.ts
```

Expected: fail because billing readiness checks do not exist.

- [ ] **Step 3: Implement billing readiness analyzer**

Add `analyzeBillingReadiness(manifests, files)` to `readiness.ts`. Use static string/regex signals only:

- Stripe/payment provider signal: package dependency `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`, or source text containing `stripe.checkout`, `checkout.sessions.create`, `PaymentIntent`, `price_`, or `Stripe(`.
- Webhook route signal: source path or text containing `webhook`, `stripe-signature`, `checkout.session.completed`, or `customer.subscription`.
- Signature verification signal: `stripe.webhooks.constructEvent`, `constructEventAsync`, `stripe-signature`, `STRIPE_WEBHOOK_SECRET`, or `webhookSecret`.
- Billing portal signal: `billingPortal.sessions.create`, `billing_portal`, `customer portal`, `/billing`, `/account/billing`, or `/settings/billing`.

Return no billing findings when no payment provider signal exists.

- [ ] **Step 4: Wire source samples into billing readiness**

In `scan.ts`, include source sample files in the evidence passed to `analyzeBillingReadiness`.

- [ ] **Step 5: Run tests to verify pass**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/findings.test.ts src/lib/scan/repo/readiness.test.ts src/lib/scan/repo/scan.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit Task 4**

Run:

```powershell
git add apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts apps/preflight/src/lib/scan/repo/scan.ts apps/preflight/src/lib/scan/repo/scan.test.ts
git commit -m "feat: add billing readiness repo checks"
```

## Task 5: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused scanner tests**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/findings.test.ts src/lib/scan/repo/readiness.test.ts src/lib/scan/repo/scan.test.ts
```

Expected: pass.

- [ ] **Step 2: Run preflight verification**

Run:

```powershell
npm.cmd run verify -w preflight
```

Expected: pass.

- [ ] **Step 3: Review final diff**

Run:

```powershell
git status --short
git log --oneline -6
```

Expected: clean worktree after commits, with task commits on `codex/deploylint-normalized-findings`.
