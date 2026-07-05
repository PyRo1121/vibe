# Plan - Deploylint core security monitoring

Spec: ../specs/2026-07-05-deploylint-github-mcp-next-level-roadmap.md

Goal: make Deploylint feel like a real deployment guardrail before MCP/GitHub polish: deeper linting, CVE detection, regression tracking, and alpha-safe notification plumbing.

## Phase 1 - Security snapshot and diff core

1. Add `src/lib/monitoring/security-diff.ts`.
2. Snapshot alert-worthy checks only: dependency CVEs, exposed env/git/backups, HTTPS/security headers, mixed content, form security, secrets, and license risk.
3. Diff snapshots into `newIssues`, `worsenedIssues`, `resolvedIssues`, and `shouldNotify`.
4. Verify with `npm.cmd run test -w preflight -- src/lib/monitoring/security-diff.test.ts`.

Acceptance:

- Normal launch-readiness warnings do not become security alerts.
- New CVEs/security failures notify.
- Warn-to-fail or severity increases notify.
- Resolved issues are tracked without notifying.

## Phase 2 - Monitor target storage

1. Add a storage module beside `report-store.ts` for monitor targets.
2. KV keys:
   - `monitor-target:<id>` for target config.
   - `monitor-index:<accountOrAlphaUser>` for target lists.
   - `monitor-snapshot:<targetId>` for last security snapshot.
   - `monitor-event:<targetId>:<timestamp>` for notification history.
3. Store target URL, normalized URL, created time, cadence, notification preferences, and last scan status.
4. Keep alpha mode free, but model `plan: "alpha-free" | "paid"` so the paywall can turn on later without changing data shape.

Acceptance:

- Target storage is deterministic and test-covered with a fake KV namespace.
- The stored shape has no Stripe-only assumptions while alpha is free.

## Phase 3 - Alpha monitor API

1. Add server endpoints for creating, listing, and deleting monitor targets.
2. Reuse existing URL validation and SSRF guardrails before accepting a target.
3. Require no payment in alpha, but return future plan metadata for UI copy.
4. Add rate limits through the existing durable object limiter.

Acceptance:

- Bad/private URLs are rejected.
- Duplicate target URLs collapse to one target per user/session scope.
- API tests cover create/list/delete and alpha plan response.

## Phase 4 - Scheduled scan runner

1. Add a Cloudflare scheduled handler that loads due monitor targets.
2. Run existing scan engine, then `snapshotSecurityIssues` and `diffSecuritySnapshots`.
3. Persist the current snapshot and an event record for new/worsened/resolved issues.
4. Configure `triggers.crons` in `wrangler.jsonc`.

Acceptance:

- Cron can process a small batch without blocking unrelated scans.
- Failed target scans record an operational event and retry later.
- No notification is sent unless `shouldNotify` is true.

## Phase 5 - Notification drafting

1. Add a notification formatter that produces concise security alerts.
2. Support an internal event sink first; add Cloudflare Email or webhook delivery only after the event format is stable.
3. Keep copy honest during alpha: "Some checks may be broken or changing while Deploylint is in active development."

Acceptance:

- Notification text includes URL, issue title, severity, status, and recommended next action.
- The formatter is covered without requiring live email/webhook credentials.

## Phase 6 - Report and dashboard UX

1. Add a monitor panel to the scan result page for alpha users.
2. Show current free alpha state and future paid feature boundaries.
3. Add a security history view: new, worsened, resolved, last checked.
4. Keep top-left `Alpha` label and development disclaimer visible but quiet.

Acceptance:

- Users can understand what will be paid later without losing access during alpha.
- Security history is scannable and does not bury the main launch report.

## Phase 7 - Verification and deploy

1. Run focused tests for monitoring modules.
2. Run `npm.cmd run verify:preflight`.
3. Deploy with `npm.cmd exec -w preflight -- wrangler deploy`.
4. Smoke `https://deploylint.com/` and one live scan.

Acceptance:

- Preflight verification passes.
- Worker deploy succeeds.
- Live site returns 200 and shows alpha messaging.
