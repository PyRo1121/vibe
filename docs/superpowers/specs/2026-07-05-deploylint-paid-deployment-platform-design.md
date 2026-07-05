# Deploylint Paid Deployment Platform Design

Status: ready for user review
Date: 2026-07-05
Owner: Deploylint

## Goal

Turn Deploylint from a one-time launch checklist into a subscription product people pay for because it protects deploys, revenue, and public trust.

The paid product should own a narrow promise:

> Deploylint watches your repo, deploy, live website, billing flow, and launch surface so AI-built SaaS apps do not ship embarrassing or revenue-breaking regressions.

This design builds on the current SvelteKit and Cloudflare Workers app in `apps/preflight`, the existing URL/repo scanner, report storage, Stripe subscriptions, GitHub gate script, MCP package, and KV-backed monitoring helpers.

## Product Positioning

Deploylint should not compete head-on with enterprise AppSec, generic uptime monitoring, or broad SEO audit suites.

The wedge is:

- AI-built SaaS apps.
- Solo founders and small teams.
- Public launch and paid subscription readiness.
- Fix guidance that coding agents can apply.
- Continuous deploy confidence, not a one-off score.

The paid reason is not "more checks". The paid reason is "tell me before users find out".

## Pricing Packaging

Keep the public alpha free while the product is being shaped, but build the paid feature boundaries now.

### Free

- One-off URL or public GitHub repo scans.
- Public summary report.
- Top issues and one sample fix prompt when billing is enabled later.
- Full prompts while `ALPHA_FREE_UNLOCK` remains true.
- No recurring monitoring guarantee.

### Solo

- 3 monitored projects.
- Weekly scheduled scans.
- Full private reports.
- Full fix prompts and master repair prompt.
- GitHub Action gate for one repo per project.
- Email alerts for P0 regressions.

### Builder

- 10 monitored projects.
- Daily scheduled scans.
- Deep browser scan for critical public journeys.
- Stripe readiness audit.
- Slack/webhook alerts.
- Report history and before/after proof.

### Agency

- 50 monitored projects.
- Client-facing public summaries.
- Exportable reports.
- Multiple notification recipients.
- Higher scan budgets and priority queue.

## Core Product Loops

### Loop 1: One-Time Launch Review

User pastes a URL or GitHub repo. Deploylint returns a verdict, prioritized issues, fix prompts, and a private report when unlocked.

This loop drives free acquisition.

### Loop 2: Fix And Prove

User copies the master prompt, fixes issues in Codex/Cursor, deploys, and re-scans. Deploylint shows fixed blockers, regressions, and score delta.

This loop proves value.

### Loop 3: Monitor And Alert

User saves the target as a monitored project. Deploylint runs scheduled scans and alerts only when meaningful risks appear or worsen.

This loop creates subscription retention.

### Loop 4: Deployment Gate

User installs a GitHub Action, CLI, or MCP gate. Deploylint blocks P0 deploys or comments advisory findings on pull requests.

This loop embeds Deploylint in the developer workflow.

## Architecture

### Existing Foundation

Use the current app boundaries first:

- `scanUrl` and `scanRepo` keep producing `ScanReport`.
- `sanitizeReport` controls public/private prompt visibility.
- `REPORTS` KV stores report snapshots, histories, monitor targets, and monitor events in the MVP.
- `LIMITER` Durable Object remains the rate limit and daily budget control point.
- Stripe Checkout and webhooks remain the billing entry point.
- GitHub Action and MCP consume the same report/gate semantics.

### New Platform Layer

Add a small project layer instead of a full dashboard rewrite.

Suggested modules:

```text
apps/preflight/src/lib/projects/project-store.ts
apps/preflight/src/lib/projects/access.ts
apps/preflight/src/lib/monitoring/scheduler.ts
apps/preflight/src/lib/monitoring/run-monitor.ts
apps/preflight/src/lib/deep-scan/browser-scan.ts
apps/preflight/src/lib/billing/stripe-readiness.ts
```

The project layer should be minimal:

- Project owner key.
- Project name.
- Primary URL.
- Optional GitHub repo URL.
- Optional Stripe account mode metadata.
- Plan tier.
- Monitoring cadence.
- Notification settings.

KV is acceptable for the first paid MVP because the current app already uses it and the query patterns are simple owner-key lookups. Move to D1 only when account/project queries, team seats, invoices, or long history become hard to manage in KV.

### Public Versus Private Reports

Separate report modes explicitly:

- Private owner report: full prompts, master prompt, AI copy review, history, monitor events, and billing/deep-scan results.
- Public share report: sanitized summary, no private prompts, no secrets, no billing internals.

Current behavior stores prompt-stripped reports for permalinks. Keep that safety property for public links, but add owner-private retrieval so alpha and paid users do not see their own report re-locked after opening history.

## Components

### 1. Project And Target Management

Purpose:

- Let users save a URL/repo as a monitored project.
- Attach plan limits and notifications.
- Provide a stable owner-private report history.

Initial UI:

- Add a "Monitor this project" action after a scan.
- Ask only for email or webhook if no user account exists yet.
- Show saved project cards with last verdict, last scan time, and open P0 count.

Implementation notes:

- Start with owner keys derived from Stripe customer, verified email, or alpha session token.
- Do not build team accounts in the first pass.
- Reuse `monitor-store.ts` for target persistence where possible.

### 2. Deployment Gate

Purpose:

- Make Deploylint valuable before merge and after deploy.
- Turn a scanner into a workflow habit.

Surfaces:

- GitHub Action.
- Remote gate script.
- MCP `deploylint_gate`.
- Later: CLI wrapper.

Gate behavior:

- `advisory` mode comments and summarizes but never fails.
- `gate` mode fails on P0 failures, blocked scan, or configured score floor.
- Output includes top blockers, report link, and exact next action.

Required improvements:

- Stable JSON schema with `schemaVersion`.
- Optional PR comment mode.
- File annotations for repo findings with evidence paths.
- Clear messaging when the scan is partial or blocked.

### 3. Recurring Monitoring

Purpose:

- Create ongoing paid value.
- Alert on regressions, not every small warning.

Monitored signals:

- Site reachable and HTTPS.
- Public noindex or robots blocking.
- Privacy/legal page loss.
- Exposed `.env`, `.git`, backup files, source maps.
- Stripe/payment integration regressions.
- Broken pricing/signup/checkout public paths.
- GitHub repo secrets, env commits, high severity dependency vulnerabilities.
- DNS/email auth regressions.
- Significant score drops.

Alert rules:

- Alert immediately on new P0.
- Alert when a P1 fails after previously passing.
- Alert on blocked scan after two consecutive failures to reduce false alarms.
- Send a weekly digest when only P2 polish changed.

### 4. Deep Browser Scan

Purpose:

- Make paid scans materially better than free static scans.
- Catch problems static HTML cannot see.

Deep Scan v1 journeys:

- Homepage renders without blank screen.
- Mobile viewport has no obvious horizontal overflow.
- Pricing page renders and primary CTA is visible.
- Signup/login route responds when linked.
- Checkout-start button exists and opens a payment provider page or expected app route.
- Contact/waitlist form can be submitted in dry-run mode only when explicitly configured.

Constraints:

- No destructive form submission by default.
- No credential handling in v1.
- No payment completion in v1.
- Browser checks run async with a timeout budget.

Recommended runtime:

- Start with a queued Worker calling an internal browser service only if a browser runtime is available.
- If Cloudflare Browser Rendering is available in the account, use it.
- Otherwise keep Deep Scan behind a feature flag and implement the API/data model first.

### 5. Stripe Readiness Audit

Purpose:

- Justify paid upgrades with direct revenue risk.
- Detect broken subscription plumbing before customers do.

Audit levels:

- Static public scan: detects Stripe.js and warns with manual checklist.
- Server-config scan: verifies configured price IDs exist in app env and Checkout requests use subscription mode.
- Stripe API audit: with server secret available to the app owner, verify products, prices, webhooks, customer portal, live/test consistency, and required events.

MVP checks for this repo:

- `STRIPE_PRICE_SOLO`, `STRIPE_PRICE_BUILDER`, and `STRIPE_PRICE_AGENCY` are configured.
- Checkout uses `mode=subscription`.
- Success and cancel URLs are set.
- Webhook signature verification is present.
- Webhook handles `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- Fulfillment only unlocks paid/complete sessions.
- Customer portal/cancel path is either implemented or explicitly marked missing.

Security rule:

- Never store or display Stripe secret keys.
- If a key was pasted into chat or logs, rotate it and use Workers secrets only.

### 6. Fix Automation

Purpose:

- Move from "here is the issue" to "here is the patch plan".

MVP:

- Improve master repair prompt quality.
- Add fix plans grouped by P0/P1/P2.
- Generate GitHub issue bodies or PR comments.
- MCP tool returns ordered repair tasks.

Later:

- Draft fix PRs for small deterministic changes, such as headers, robots, missing manifest, obvious metadata, or CI config.

Guardrail:

- Do not auto-edit arbitrary user repos in the hosted product until authentication, permissions, preview, and rollback are designed.

## Data Flow

### One-Time Scan

1. User submits URL or repo.
2. `/api/scan` runs `scanUrl` or `scanRepo`.
3. Server resolves access state.
4. Server returns private unlocked report when allowed.
5. Server stores public sanitized report for permalink.
6. When the request has an owner key, server stores the private report under owner/project scope.

### Save Monitoring Target

1. User clicks "Monitor this project".
2. Server validates plan limit and owner key.
3. Server upserts project and monitor target.
4. Server stores current scan as baseline snapshot.
5. UI shows next scheduled scan and alert settings.

### Scheduled Monitor Run

1. Scheduler selects due targets by cadence.
2. Runner executes standard scan first.
3. Runner optionally executes Deep Scan and Stripe audit based on plan.
4. Runner compares current findings to previous snapshot.
5. Runner records monitor event when new or worsened issues appear.
6. Runner sends email/webhook alert if alert rules match.

### Deployment Gate

1. GitHub Action, MCP, or CLI sends URL/repo and gate options.
2. API runs scan or loads latest monitor result when allowed.
3. Gate evaluator applies P0, verdict, and score-floor rules.
4. Consumer receives markdown, JSON, and optional annotations.

## Error Handling

Errors must be actionable and tier-aware.

Use explicit categories:

- `invalid_input`: invalid URL, unsupported repo, private repo.
- `scan_blocked`: target blocks scanner, bot protection, non-200 homepage.
- `capacity_limited`: rate limit, daily budget, queue full.
- `integration_missing`: missing Stripe key, webhook secret, GitHub token, notification destination.
- `partial_scan`: sitemap truncated, repo tree truncated, browser scan unavailable, OSV unavailable.
- `provider_error`: GitHub, Stripe, DNS, OSV, browser runtime, email provider.

Rules:

- Static scan failures should not fake pass results.
- Partial scans should produce confidence warnings.
- Paid monitor alerts should avoid noisy transient failures.
- Public reports should not leak provider errors containing secrets or account details.

## Testing Strategy

### Unit Tests

- Project store owner isolation and plan limits.
- Public/private report sanitization.
- Monitor diff and alert rules.
- Gate evaluator modes.
- Stripe readiness parser/auditor.
- Deep Scan result normalization.

### Integration Tests

- `/api/scan` returns unlocked alpha report while storing sanitized public report.
- Owner-private report remains unlocked for owner.
- Saved monitor target produces baseline snapshot.
- Repeated monitor run records fixed and regressed issues.
- Gate JSON schema remains backward compatible.

### Smoke Tests

- Homepage scan still works.
- Public repo scan still works.
- Public report permalink works.
- Private owner report opens unlocked.
- Checkout endpoint is reachable or rate-limited as expected.
- Stripe webhook endpoint verifies signatures.
- Gate script returns expected pass/fail result against fixtures.

### Manual Release Checks

- Run a real public URL scan.
- Run a real public GitHub repo scan.
- Install the GitHub Action in a throwaway repo.
- Trigger a monitor run manually.
- Verify a Stripe test or live-mode audit without exposing keys.

## Phased Implementation

### Phase 1: Trust And Paid Boundary

Objective: make the current product internally consistent and worth saving.

Deliverables:

- Fix alpha/private/public report gating.
- Add check catalog completeness enforcement.
- Add score/verdict clarity with visible blocker counts.
- Surface repo tree truncation and scan confidence.
- Add "Monitor this project" CTA without scheduling yet.

Exit criteria:

- Fresh scans and owner report history show full prompts while alpha is free.
- Public report links stay sanitized.
- Every emitted check has catalog explanation or an explicit "internal only" exclusion.
- `npm.cmd run verify:preflight` passes.

### Phase 2: Monitored Projects MVP

Objective: create the paid retention loop.

Deliverables:

- Save monitored projects.
- Show project list and last scan state.
- Manual "run monitor now" action.
- Baseline snapshot and event history.
- Email or webhook alert for new P0.

Exit criteria:

- A saved target can be scanned twice and show fixed/regressed issues.
- Plan limits are enforced.
- Alerts are tested with fake notification adapters.

### Phase 3: Deployment Gate Productization

Objective: make Deploylint installable in real repos.

Deliverables:

- Stable gate JSON schema.
- Better GitHub Action docs and install snippets.
- Advisory and blocking modes.
- PR comment output.
- File annotations for repo evidence.

Exit criteria:

- Throwaway external repo can run the action.
- Advisory mode never fails.
- Gate mode fails on P0.

### Phase 4: Deep Browser Scan V1

Objective: add paid-only checks static scanners cannot catch.

Deliverables:

- Async scan result model.
- Browser render for homepage and pricing.
- Mobile overflow check.
- Checkout-start detection.
- Screenshot evidence for private reports.

Exit criteria:

- Deep Scan result appears in private report.
- Static scan still works when browser runtime is unavailable.
- No destructive form or payment action happens by default.

### Phase 5: Stripe Readiness Audit

Objective: protect revenue and justify Builder tier.

Deliverables:

- Internal Stripe readiness checks for this app.
- Generic Stripe audit model for monitored projects.
- Webhook/price/product/portal checklist.
- Clear redaction of all sensitive values.

Exit criteria:

- App can verify its own configured Stripe products and prices.
- Missing customer portal or webhook handling appears as an actionable finding.

### Phase 6: MCP Fix Plan And Automation

Objective: make coding agents act on Deploylint findings.

Deliverables:

- `deploylint_fix_plan`.
- `deploylint_compare_runs`.
- `deploylint_github_workflow`.
- MCP resources for check catalog and install docs.

Exit criteria:

- MCP can scan, gate, and produce a repair plan without local repo mutation.
- Outputs are typed, deterministic, and documented.

## Acceptance Criteria For The Paid Platform MVP

- A user can run a free scan, save a project, and see a private owner report.
- A public share link never leaks full prompts or sensitive integration details.
- A monitored project can detect a new P0 regression and produce an alert event.
- A GitHub gate can block a P0 deploy.
- Builder-tier architecture supports Deep Scan and Stripe audit without changing the `ScanReport` contract in a breaking way.
- Every new paid feature has clear free/paid/alpha copy.
- Verification remains green with `npm.cmd run verify:preflight`.

## Non-Goals

- No enterprise SSO.
- No team seat management in the MVP.
- No arbitrary code execution.
- No automatic fix PRs in the hosted MVP.
- No private GitHub repo support until auth and permission model are designed.
- No destructive browser journeys.
- No long-term analytics warehouse in the first paid MVP.

## Open Decisions Resolved

- First paid wedge: deployment gate plus recurring monitoring.
- Upgrade drivers: Deep Browser Scan and Stripe Readiness Audit.
- Storage for MVP: continue KV-first and introduce D1 only when query needs force it.
- Public reports: remain sanitized.
- Owner reports: should be private and unlocked when access allows.
- Action/MCP: distribution layers use the same scan and gate semantics, not separate product logic.
