# Deploylint Cloudflare Data Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Deploylint's authoritative scan, billing, and monitoring state out of KV and into D1, while keeping KV for public report snapshots and cache, Workflows for recurring monitoring, Queues for async fanout, and Durable Objects for rate limits/coordination only.

**Architecture:** D1 becomes the source of truth for scan metadata, history, monitor targets, notification events, Stripe unlocks, and webhook idempotency. KV remains `REPORTS` and stores prompt-stripped public report snapshots plus short-lived cache keys only. A scheduled Workflow selects due monitors and enqueues scan jobs; Queue consumers run scans and notification fanout; Durable Objects stay scoped to the existing `LIMITER` binding while D1 leases handle scan coordination.

**Tech Stack:** SvelteKit on Cloudflare Workers, Wrangler 4.x, Cloudflare D1, Workers KV, Workflows, Queues, Durable Objects, Vitest.

---

## Assumption

No app auth model exists in the inspected files, so `owner_key` remains the current alpha/session/account key until a real user/account table lands.

## Current State

- `apps/preflight/wrangler.jsonc` currently binds `REPORTS` as KV, `LIMITER` as a SQLite-backed Durable Object, `AI`, and `SELF`.
- `apps/preflight/src/lib/server/report-store.ts` writes `report:<id>` snapshots and per-URL `history:<hash>` arrays to KV.
- `apps/preflight/src/lib/monitoring/monitor-store.ts` writes monitor targets, owner indexes, last security snapshots, and monitor events to KV.
- `apps/preflight/src/routes/api/webhooks/stripe/+server.ts` writes Stripe webhook dedupe keys and unlock records through the same KV namespace.
- `apps/preflight/src/lib/server/rate-limit.ts` and `apps/preflight/src/lib/server/usage-budget.ts` already prefer the `LIMITER` Durable Object for atomic counters, with KV fallback for local/dev.
- `docs/superpowers/plans/2026-07-05-deploylint-core-security-monitoring.md` defines monitor targets, snapshots, events, scheduled scans, and notifications, but its KV storage design should be superseded by this D1 plan before building the runner.

## Data Ownership

| State                                              | Primary store  | Binding                      | Reason                                                                     |
| -------------------------------------------------- | -------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Public report body for `/r/[id]` and badge routes  | KV             | `REPORTS`                    | Read-heavy, prompt-stripped, public, TTL-friendly.                         |
| Scan report metadata, history, and issue snapshots | D1             | `DEPLOYLINT_DB`              | Queryable history and consistency for re-scans/monitoring.                 |
| Monitor targets, last snapshot, monitor events     | D1             | `DEPLOYLINT_DB`              | Authoritative user-facing state, list/delete/update semantics.             |
| Stripe unlocks and webhook event dedupe            | D1             | `DEPLOYLINT_DB`              | Payment state and idempotency should not rely on eventually consistent KV. |
| Scan job and notification job status               | D1             | `DEPLOYLINT_DB`              | Queue messages are delivery triggers; D1 tracks idempotency and status.    |
| Due monitor scheduling                             | Workflows      | `MONITOR_WORKFLOW`           | Durable scheduled orchestration, not request-path work.                    |
| Scan and notification fanout                       | Queues         | `SCAN_QUEUE`, `NOTIFY_QUEUE` | Async retryable work outside user requests.                                |
| Rate limits and short windows                      | Durable Object | `LIMITER`                    | Existing atomic counter primitive.                                         |
| Per-target scan lease                              | D1             | `DEPLOYLINT_DB`              | Avoid a new Durable Object class; use D1 idempotency/lease rows first.     |

KV rule: after this migration, new code should not write authoritative state to `REPORTS`. Allowed key families are `report:<publicId>`, `cache:<purpose>:<hash>`, and temporary backfill checkpoints.

## Proposed Binding Names

Keep existing names unless a new platform resource is required. Do not add a new Durable Object binding in this modernization pass; keep `LIMITER` as the only DO binding.

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "REPORTS",
      "id": "dac1d86110704359a9e7c08a24cc9873",
    },
  ],
  "d1_databases": [
    {
      "binding": "DEPLOYLINT_DB",
      "database_name": "deploylint-prod",
      "database_id": "<created-by-wrangler-d1-create>",
      "migrations_dir": "migrations",
    },
  ],
  "workflows": [
    {
      "name": "deploylint-monitor-workflow",
      "binding": "MONITOR_WORKFLOW",
      "class_name": "DeploylintMonitorWorkflow",
      "schedules": ["*/15 * * * *"],
    },
  ],
  "queues": {
    "producers": [
      { "binding": "SCAN_QUEUE", "queue": "deploylint-scan-jobs" },
      { "binding": "NOTIFY_QUEUE", "queue": "deploylint-notifications" },
    ],
    "consumers": [
      {
        "queue": "deploylint-scan-jobs",
        "max_batch_size": 5,
        "max_batch_timeout": 10,
        "max_retries": 3,
        "dead_letter_queue": "deploylint-scan-dead",
        "max_concurrency": 3,
        "retry_delay": 60,
      },
      {
        "queue": "deploylint-notifications",
        "max_batch_size": 10,
        "max_batch_timeout": 10,
        "max_retries": 5,
        "dead_letter_queue": "deploylint-notification-dead",
        "max_concurrency": 5,
        "retry_delay": 120,
      },
    ],
  },
}
```

Wrangler setup commands:

```powershell
npm.cmd exec -w preflight -- wrangler d1 create deploylint-prod
npm.cmd exec -w preflight -- wrangler queues create deploylint-scan-jobs
npm.cmd exec -w preflight -- wrangler queues create deploylint-scan-dead
npm.cmd exec -w preflight -- wrangler queues create deploylint-notifications
npm.cmd exec -w preflight -- wrangler queues create deploylint-notification-dead
```

## Proposed D1 Tables

Create `apps/preflight/migrations/0001_deploylint_core_state.sql` with this schema.

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE scan_reports (
	id TEXT PRIMARY KEY,
	public_id TEXT UNIQUE,
	url TEXT NOT NULL,
	final_url TEXT NOT NULL,
	final_url_hash TEXT NOT NULL,
	score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
	verdict TEXT NOT NULL,
	scanned_at TEXT NOT NULL,
	scan_coverage TEXT,
	report_json TEXT NOT NULL CHECK (json_valid(report_json)),
	public_report_json TEXT NOT NULL CHECK (json_valid(public_report_json)),
	created_at TEXT NOT NULL,
	expires_at TEXT
);

CREATE INDEX scan_reports_final_url_hash_scanned_at_idx
	ON scan_reports(final_url_hash, scanned_at DESC);

CREATE TABLE scan_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	final_url_hash TEXT NOT NULL,
	final_url TEXT NOT NULL,
	report_id TEXT NOT NULL REFERENCES scan_reports(id) ON DELETE CASCADE,
	public_id TEXT,
	score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
	verdict TEXT NOT NULL,
	scanned_at TEXT NOT NULL,
	issues_json TEXT NOT NULL CHECK (json_valid(issues_json)),
	created_at TEXT NOT NULL
);

CREATE INDEX scan_history_url_scanned_idx
	ON scan_history(final_url_hash, scanned_at DESC);

CREATE TABLE unlock_records (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	canonical_scan_url TEXT NOT NULL,
	canonical_scan_url_hash TEXT NOT NULL UNIQUE,
	stripe_session_id TEXT NOT NULL,
	plan_id TEXT,
	status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded', 'revoked')),
	paid_at TEXT NOT NULL,
	expires_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX unlock_records_session_idx
	ON unlock_records(stripe_session_id);

CREATE TABLE stripe_webhook_events (
	event_id TEXT PRIMARY KEY,
	event_type TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
	session_id TEXT,
	processed_at TEXT,
	error_message TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE monitor_targets (
	id TEXT PRIMARY KEY,
	owner_key TEXT NOT NULL,
	display_url TEXT NOT NULL,
	normalized_url TEXT NOT NULL,
	normalized_url_hash TEXT NOT NULL,
	cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly')),
	plan TEXT NOT NULL CHECK (plan IN ('alpha-free', 'paid')),
	notification_enabled INTEGER NOT NULL DEFAULT 1 CHECK (notification_enabled IN (0, 1)),
	email TEXT,
	webhook_url TEXT,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ok', 'alert', 'error', 'paused')),
	last_scan_at TEXT,
	next_scan_at TEXT NOT NULL,
	last_report_id TEXT REFERENCES scan_reports(id) ON DELETE SET NULL,
	last_error TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	deleted_at TEXT,
	UNIQUE(owner_key, normalized_url_hash)
);

CREATE INDEX monitor_targets_due_idx
	ON monitor_targets(next_scan_at, status)
	WHERE deleted_at IS NULL;

CREATE INDEX monitor_targets_owner_idx
	ON monitor_targets(owner_key, created_at DESC)
	WHERE deleted_at IS NULL;

CREATE TABLE security_snapshots (
	target_id TEXT PRIMARY KEY REFERENCES monitor_targets(id) ON DELETE CASCADE,
	report_id TEXT REFERENCES scan_reports(id) ON DELETE SET NULL,
	url TEXT NOT NULL,
	final_url TEXT NOT NULL,
	scanned_at TEXT NOT NULL,
	score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
	issues_json TEXT NOT NULL CHECK (json_valid(issues_json)),
	created_at TEXT NOT NULL
);

CREATE TABLE monitor_events (
	id TEXT PRIMARY KEY,
	target_id TEXT NOT NULL REFERENCES monitor_targets(id) ON DELETE CASCADE,
	report_id TEXT REFERENCES scan_reports(id) ON DELETE SET NULL,
	type TEXT NOT NULL CHECK (type IN ('new-issues', 'worsened-issues', 'resolved', 'scan-error')),
	issue_ids_json TEXT NOT NULL CHECK (json_valid(issue_ids_json)),
	message TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX monitor_events_target_created_idx
	ON monitor_events(target_id, created_at DESC);

CREATE TABLE scan_jobs (
	id TEXT PRIMARY KEY,
	idempotency_key TEXT NOT NULL UNIQUE,
	source TEXT NOT NULL CHECK (source IN ('manual', 'monitor', 'backfill')),
	target_id TEXT REFERENCES monitor_targets(id) ON DELETE SET NULL,
	url TEXT NOT NULL,
	normalized_url TEXT,
	status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead')),
	priority INTEGER NOT NULL DEFAULT 100,
	attempts INTEGER NOT NULL DEFAULT 0,
	available_at TEXT NOT NULL,
	started_at TEXT,
	finished_at TEXT,
	report_id TEXT REFERENCES scan_reports(id) ON DELETE SET NULL,
	workflow_instance_id TEXT,
	error_message TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX scan_jobs_status_available_idx
	ON scan_jobs(status, available_at, priority);

CREATE TABLE notification_jobs (
	id TEXT PRIMARY KEY,
	idempotency_key TEXT NOT NULL UNIQUE,
	event_id TEXT NOT NULL REFERENCES monitor_events(id) ON DELETE CASCADE,
	target_id TEXT NOT NULL REFERENCES monitor_targets(id) ON DELETE CASCADE,
	channel TEXT NOT NULL CHECK (channel IN ('email', 'webhook', 'internal')),
	destination_hash TEXT,
	status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'dead', 'skipped')),
	attempts INTEGER NOT NULL DEFAULT 0,
	available_at TEXT NOT NULL,
	sent_at TEXT,
	error_message TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX notification_jobs_status_available_idx
	ON notification_jobs(status, available_at);
```

## Migration Phases

### Phase 0: Freeze the data contract

- [ ] Confirm no new authoritative KV key families are added during this modernization branch.
- [ ] Update the implementation issue or PR description with the binding names above.
- [ ] Run:

```powershell
git status --short
npm.cmd run test -w preflight -- src/lib/server/report-store.test.ts src/lib/monitoring/monitor-store.test.ts src/lib/monitoring/security-diff.test.ts
```

Expected: tests pass before storage changes begin.

### Phase 1: Add D1 binding, types, and migration

- [ ] Create `deploylint-prod` with Wrangler and add the `DEPLOYLINT_DB` binding to `apps/preflight/wrangler.jsonc`.
- [ ] Add the SQL file above at `apps/preflight/migrations/0001_deploylint_core_state.sql`.
- [ ] Update `apps/preflight/src/cloudflare-env.d.ts` with:

```ts
DEPLOYLINT_DB?: D1Database;
MONITOR_WORKFLOW?: Workflow;
SCAN_QUEUE?: Queue<ScanJobMessage>;
NOTIFY_QUEUE?: Queue<NotificationJobMessage>;
```

Use these message shapes in the queue module:

```ts
export interface ScanJobMessage {
  jobId: string;
  targetId?: string;
  url: string;
  source: "manual" | "monitor" | "backfill";
  requestedAt: string;
}

export interface NotificationJobMessage {
  jobId: string;
  eventId: string;
  targetId: string;
  channel: "email" | "webhook" | "internal";
  requestedAt: string;
}
```

- [ ] Run:

```powershell
npm.cmd exec -w preflight -- wrangler d1 migrations apply deploylint-prod --local
npm.cmd run cf-typegen -w preflight
npm.cmd run check -w preflight
```

Expected: local D1 migration applies and Svelte/TypeScript checks pass.

### Phase 2: Build D1 repositories behind existing APIs

- [ ] Create `apps/preflight/src/lib/server/deploylint-db.ts` for prepared-statement helpers and JSON serialization guards.
- [ ] Replace KV-only report persistence with a dual-write repository in `apps/preflight/src/lib/server/report-store.ts`: D1 first for metadata/history, then KV `report:<publicId>` for public snapshot serving.
- [ ] Replace `apps/preflight/src/lib/monitoring/monitor-store.ts` KV calls with D1 queries using `monitor_targets`, `security_snapshots`, and `monitor_events`.
- [ ] Keep public loading fallback: `/r/[id]` and badge routes should still read KV first for hot public snapshots, then D1 only if the KV snapshot is missing and the report is not expired.
- [ ] Add tests that simulate KV failure after successful D1 write; expected behavior is scan response still succeeds with D1 metadata but no public snapshot id.

Focused commands:

```powershell
npm.cmd run test -w preflight -- src/lib/server/report-store.test.ts
npm.cmd run test -w preflight -- src/lib/monitoring/monitor-store.test.ts
npm.cmd run test -w preflight -- src/lib/server/scan-handler.test.ts
```

### Phase 3: Move Stripe unlocks and webhook idempotency to D1

- [ ] Move `unlock_records` reads/writes out of KV while preserving the current key derivation behavior for canonical scan URLs.
- [ ] Move `stripe_webhook_events` idempotency out of KV.
- [ ] Keep a temporary read fallback from old KV unlock keys for 30 days so paid/unlocked scans do not strand existing users.
- [ ] Write a one-time backfill script `apps/preflight/scripts/backfill-kv-to-d1.mjs` that scans known KV key prefixes and inserts D1 rows idempotently.

Focused commands:

```powershell
npm.cmd run test -w preflight -- src/lib/billing/unlock-store.test.ts
npm.cmd run test -w preflight -- src/routes/api/webhooks/stripe/server.test.ts
npm.cmd run verify:preflight
```

### Phase 4: Add Queues for scan and notification fanout

- [ ] Add `SCAN_QUEUE` producer use to manual scan endpoints only after D1 job status exists; the first release can keep manual scans synchronous and use queues for monitors only.
- [ ] Add a Queue consumer that accepts `{ jobId, targetId, url, source, requestedAt }`, marks `scan_jobs.status='running'`, runs the existing scan engine, writes `scan_reports`, `scan_history`, updates `security_snapshots`, records `monitor_events`, and emits notification messages when `shouldNotify` is true.
- [ ] Add `NOTIFY_QUEUE` consumer that marks `notification_jobs` and supports `internal` first; email/webhook delivery can be enabled after secrets and endpoint validation are present.
- [ ] Make every Queue handler idempotent by checking `scan_jobs.idempotency_key` or `notification_jobs.idempotency_key` before doing work.

Focused commands:

```powershell
npm.cmd run test -w preflight -- src/lib/monitoring/security-diff.test.ts
npm.cmd run test -w preflight -- src/lib/monitoring/monitor-store.test.ts
npm.cmd run verify:preflight
```

### Phase 5: Add scheduled Workflow for recurring monitors

- [ ] Add `DeploylintMonitorWorkflow` and export it through the same post-build pattern used for `CounterLimiter`, so SvelteKit dev does not eagerly import Workers-only runtime code.
- [ ] Workflow step 1: query up to 100 due `monitor_targets` rows with `deleted_at IS NULL`, `status != 'paused'`, and `next_scan_at <= now`.
- [ ] Workflow step 2: create idempotent `scan_jobs` rows with keys like `monitor:<targetId>:<scheduledBucket>`.
- [ ] Workflow step 3: enqueue each new job to `SCAN_QUEUE`.
- [ ] Workflow step 4: advance each target's `next_scan_at` based on cadence only after the job row is created.

Focused commands:

```powershell
npm.cmd run build -w preflight
npm.cmd exec -w preflight -- wrangler d1 migrations apply deploylint-prod --local
npm.cmd run verify:preflight
```

### Phase 6: Production backfill and cutover

- [ ] Apply D1 migrations remotely:

```powershell
npm.cmd exec -w preflight -- wrangler d1 migrations apply deploylint-prod --remote
```

- [ ] Run the backfill script with a dry-run mode first:

```powershell
npm.cmd exec -w preflight -- node scripts/backfill-kv-to-d1.mjs --dry-run
npm.cmd exec -w preflight -- node scripts/backfill-kv-to-d1.mjs --apply
```

- [ ] Deploy with queues/workflow configured:

```powershell
npm.cmd run deploy:preflight
npm.cmd run smoke:preflight
```

Expected: deploy succeeds; smoke may report the known checkout throttle as `429 Too many checkout attempts`, which is acceptable when the script treats it as endpoint reachability/protection.

### Phase 7: Remove old authoritative KV paths

- [ ] Remove KV writes for history arrays, monitor targets, monitor snapshots, monitor events, unlocks, and webhook events.
- [ ] Leave KV writes for `report:<publicId>` public snapshots and explicit `cache:*` keys only.
- [ ] Remove temporary KV fallback for unlocks after 30 days or after the backfill report confirms no active unlocks are KV-only.
- [ ] Add a guard test that fails if `monitor-store.ts` accepts `KVNamespace`.

Full verification:

```powershell
npm.cmd run verify:preflight
npm.cmd run smoke:preflight
```

## Acceptance Criteria

- `REPORTS` KV contains no new authoritative monitor, unlock, webhook, job, or history state after cutover.
- D1 has queryable rows for scan reports, scan history, unlock records, webhook events, monitor targets, security snapshots, monitor events, scan jobs, and notification jobs.
- Existing public report URLs continue to work from KV, with D1 fallback available for non-expired reports.
- Recurring monitoring is driven by `MONITOR_WORKFLOW`, not a request-path loop or top-level cron handler.
- `SCAN_QUEUE` and `NOTIFY_QUEUE` consumers are idempotent and have dead-letter queues configured.
- Durable Objects are still limited to the existing `LIMITER` binding; durable business records do not live inside DO storage.
- Local migration and verification commands pass.
- Remote migration, deploy, and smoke commands pass before deleting KV fallbacks.

## Risks

- `apps/preflight/wrangler.jsonc` is already dirty in the current worktree; implementation agents must preserve concurrent edits and inspect diffs before changing it.
- D1 remote migrations are durable production changes; use local migrations and a dry-run backfill before `--remote`.
- Queue delivery is retryable and may be at-least-once in practice, so D1 idempotency keys are mandatory.
- Workflow schedules require a Wrangler version/schema that understands `workflows[].schedules`; the root currently pins Wrangler `^4.107.0`, which should be recent enough, but implementation should still run `npm.cmd run cf-typegen -w preflight` after editing bindings.
- KV consistency means old KV history/unlock data may lag during backfill; backfill should be idempotent and safe to run more than once.
- SvelteKit/Workers runtime exports have already been sensitive around Durable Objects; Workflow classes should follow the post-build export pattern instead of direct server-hook imports.
- Public report storage in both D1 and KV duplicates JSON temporarily. Keep the D1 `expires_at` and KV TTL aligned to prevent unbounded storage.

## Source Links

- Cloudflare Wrangler configuration for D1, KV, Queues, service bindings, and Workflows: https://developers.cloudflare.com/workers/wrangler/configuration/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Cloudflare D1 Worker Binding API: https://developers.cloudflare.com/d1/worker-api/d1-database/
- Cloudflare Workers KV consistency and cache guidance: https://developers.cloudflare.com/kv/concepts/how-kv-works/
- Cloudflare KV concurrent write guidance: https://developers.cloudflare.com/kv/api/write-key-value-pairs/
- Cloudflare Workflows scheduled binding docs: https://developers.cloudflare.com/workflows/build/trigger-workflows/
- Cloudflare Queues overview: https://developers.cloudflare.com/queues/
- Cloudflare Durable Objects overview: https://developers.cloudflare.com/durable-objects/

## Self-Review

- Spec coverage: includes KV-to-D1 split, KV cache/public snapshot rule, Workflows, Queues, Durable Object boundaries, exact table proposal, binding names, migration phases, commands, acceptance criteria, risks, and source links.
- Placeholder scan: no `TBD` or implementation placeholders remain; resource IDs are intentionally Wrangler-created values and are called out as such.
- Type consistency: binding names are consistent across wrangler snippet, phases, and acceptance criteria.
