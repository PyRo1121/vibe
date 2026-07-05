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

## Competitive Bar

Deploylint should be designed around what the best adjacent tools already do well:

- GitHub Advanced Security covers code scanning, CodeQL, Dependabot-related dependency review, secret scanning, and push protection for supported plans and public repositories.
- Semgrep provides SAST/SCA/secrets workflows with PR comments, block/comment modes, and developer-facing remediation.
- Snyk covers SCA, code security, containers, IaC scanning, CI/CD gates, and in-code remediation.
- Checkly-style synthetic monitoring uses Playwright/API checks to prove real user flows such as login, checkout, and API payloads.

Deploylint should not try to replace all of them. The superior angle is to combine:

- Repo readiness.
- GitHub workflow safety.
- Live URL launch readiness.
- Revenue-flow checks.
- Synthetic browser journeys.
- Monitoring/regression history.
- Agent-ready repair plans.

The product should answer a question those tools do not answer cleanly for solo builders:

> Can I deploy this AI-built SaaS today without breaking launch, checkout, SEO, trust, or the core user journey?

## Superiority Check Matrix

Each check family should have an execution mode. Hosted checks must stay read-only and cheap. Connected GitHub checks may run commands in the user's own CI runner. GitHub App checks may inspect repository settings. MCP checks may guide a local agent to run commands and report structured results.

### A. Repository And Toolchain Readiness

Static hosted scan:

- Detect package manager: npm, pnpm, yarn, bun.
- Detect workspace layout: root app, monorepo, nested apps, package workspaces.
- Detect framework: SvelteKit, Next.js, Astro, Remix/React Router, Vite, Nuxt, Laravel, Rails, Django/FastAPI, Go, Rust.
- Detect required script surface: `lint`, `test`, `check` or `typecheck`, `build`, `preview` or `start`.
- Detect placeholder scripts: `true`, `exit 0`, `echo no tests`.
- Detect missing root commands when nested apps have useful commands.
- Detect lockfile presence, mixed lockfiles, package manager mismatch, missing `packageManager`.
- Detect Node version pinning via `engines.node`, `.nvmrc`, `.node-version`, Volta, or package manager metadata.
- Detect TypeScript strictness and invalid `tsconfig`.
- Detect SvelteKit projects without `svelte-check`.
- Detect Next/Vite/Svelte/Astro apps with no build script.
- Detect missing test files and missing test script.
- Detect missing formatter/linter config or config with no script.
- Detect excessive ignore patterns that skip `src/**`, `apps/**`, or route folders.
- Detect stale framework/runtime versions where a reliable ecosystem source is available.

Connected runner checks:

- Install dependencies with the detected package manager.
- Run the discovered lint command.
- Run typecheck/check command.
- Run unit tests.
- Run production build.
- Run existing Playwright or Cypress smoke tests if present.
- Capture failing command, exit code, stderr excerpt, and suggested next fix.
- Report "command absent" separately from "command failed".

Why this beats a static checklist:

- A static scanner says "you have tests". A connected Deploylint gate says "your tests actually pass on this PR".

### B. GitHub Workflow And Repository Governance

Static hosted scan:

- CI workflow exists.
- CI runs lint, typecheck/check, test, and build.
- Workflow permissions are explicit.
- `permissions: write-all` warning.
- `pull_request_target` risk detection.
- Third-party actions use floating refs such as `main`, `master`, `latest`, or `HEAD`.
- First-party actions are at least major-version pinned.
- Shell commands interpolate untrusted PR data.
- `actions/cache` keys include untrusted input.
- Artifact upload paths include broad globs such as repo root.
- Workflow exposes secrets to forked PRs.
- Deploy workflow runs on broad triggers without environment protection.
- Self-hosted runner labels are used on public PR workflows.
- OIDC permissions are present only where cloud deploy actually needs them.

GitHub App checks:

- Branch protection or rulesets exist for main/default branch.
- Required status checks include build/test/gate.
- Force pushes disabled on protected branches.
- Required pull request review count configured for team plans.
- Require conversation resolution enabled.
- CODEOWNERS present when repo has multiple critical areas.
- Dependabot alerts enabled.
- Dependabot version updates or Renovate configured.
- CodeQL/code scanning configured, or explicitly absent.
- Secret scanning/push protection status when available through API/permissions.
- Security policy `SECURITY.md` exists.
- Private vulnerability reporting enabled for public repos where applicable.
- Environments protect production deploys.
- Deployment branch rules or preview environment rules are explicit.

Connected runner checks:

- Upload Deploylint gate result as a required status.
- Comment on PR with only new or worsened launch issues.
- Add annotations for repo-backed findings with file paths.
- Export SARIF only for code/file-backed findings, never URL-only findings.

Why this beats generic GitHub security:

- GitHub and Semgrep find code/security issues. Deploylint should say whether the repo's whole delivery path is safe enough to launch.

### C. Dependency, License, And Supply Chain

Static hosted scan:

- Direct dependency license risk.
- Lockfile transitive license screen.
- OSV vulnerability lookup from lockfile.
- Missing lockfile.
- Package manager mismatch.
- Known risky package names for malware-prone ecosystems when there is high-confidence evidence.
- Postinstall scripts in dependencies when lockfile format exposes them.
- Git dependencies, tarball dependencies, local file dependencies, and registry overrides.
- `npmrc` registry overrides.
- Renovate/Dependabot configuration presence.
- Dependency update cadence from lockfile or manifest age when commit metadata is available.

Connected runner checks:

- `npm audit --json`, `pnpm audit --json`, or equivalent, advisory only.
- Optional Semgrep CE/Snyk/GitHub CodeQL integration detection and passthrough status.
- Validate that dependency review or equivalent runs on PRs.

Positioning:

- Do not compete with Snyk or Semgrep on deep SCA. Instead, detect absence, summarize critical blockers, and route users to the right fix.

### D. Infrastructure, Deployment, And Runtime Config

Static hosted scan:

- Wrangler, Vercel, Netlify, Docker, Compose, Terraform, Pulumi, Kubernetes, Helm, Fly, Railway, Render, Supabase, Firebase, and AWS Amplify config detection.
- Cloudflare `compatibility_date` staleness.
- Workers bindings present but env docs missing.
- Public `.dev.vars`, `.env`, `.env.production`, or secrets committed.
- Dockerfile copies `.env`.
- Docker image runs as root when detectable.
- Health endpoint absent for SaaS-like stacks.
- Preview/prod environment variable naming confusion.
- Missing deploy config for framework apps where CI also absent.
- Missing rollback or release documentation.

Connected runner checks:

- Build artifact generation.
- Framework adapter output exists.
- Cloudflare/Vercel/Netlify config parses.
- Optional dry-run deployment validation where the platform supports a safe dry-run mode.

GitHub App checks:

- Production deploy workflow requires protected environment.
- Deployment status is reported back to GitHub.
- Release tags or changelog exist for production releases.

Positioning:

- IaC scanners find cloud misconfiguration. Deploylint should find launch-impacting deploy readiness and missing operational guardrails.

### E. Live Site Launch Surface

Hosted scan:

- Reachability, redirect chain, HTTP status, final URL.
- HTTPS, HSTS, CSP, clickjacking, MIME sniffing, referrer policy, permissions policy.
- WWW/apex consistency.
- Canonical, title, description, H1, language, viewport.
- Open Graph, Twitter/X card, live `og:image`, image content type.
- Sitemap and robots discovery, including `noindex` and accidental robots blocks.
- `llms.txt`, AI crawler posture, and AI-answer readiness copy.
- Legal/trust pages: privacy, terms, refund, contact, security.txt.
- Cookie consent where tracking/ads scripts are detected.
- Broken internal links and anchor nav.
- Placeholder copy, default framework artifacts, stale copyright.
- Pricing page presence and primary CTA.
- Signup friction, social proof, CTA clarity.
- Page weight, render-blocking CSS, font loading, image dimensions/lazy loading.
- Exposed `.env`, `.git`, backups, package metadata, source maps, debug logs.

Deep hosted scan:

- Crawl more sitemap URLs with plan-specific budgets.
- Run a real browser render.
- Collect console errors, network errors, JS exceptions.
- Detect blank screens and hydration failures.
- Check mobile viewport overflow.
- Capture private screenshots for failed checks.
- Track layout stability heuristics before full Web Vitals integration.

### F. Synthetic Journeys And API Checks

Deep browser scan:

- Homepage loads and primary CTA is visible.
- Pricing page loads and plan CTAs are clickable.
- Signup/login route renders.
- Checkout-start flow opens Stripe/Paddle/Lemon Squeezy or expected app route.
- Dashboard route is protected or reachable depending on app type.
- Contact/waitlist form dry-run validates labels, errors, and success state without destructive submission.
- Navigation works on mobile.
- No obvious modal/cookie banner blocks primary CTA.
- Console and network errors are attached to the failed journey.

API checks:

- `/health`, `/healthz`, `/api/health`, `/status`.
- Public JSON endpoints return valid JSON and expected content type.
- API latency and status budget.
- CORS policy sanity for public APIs.
- Authenticated API checks later, only after credential storage is designed.

Positioning:

- Checkly is strong at synthetic monitoring. Deploylint can win for solo SaaS builders by generating opinionated launch journeys automatically and correlating them with repo/deploy/payment readiness.

### G. Revenue And Billing Readiness

Static hosted scan:

- Payment provider detection.
- Pricing path exists.
- Checkout CTA exists.
- Public price copy exists and does not contradict plan config.
- Terms/refund/privacy linked near checkout.

Server-config scan:

- App env has expected price IDs.
- Checkout endpoint uses subscription mode when subscription pricing is selected.
- Success/cancel URLs exist.
- Webhook endpoint exists.
- Webhook signature verification exists.
- Paid fulfillment only happens after paid/complete events.
- Customer portal or cancellation path exists.

Stripe API audit:

- Products and prices exist and are active.
- Live/test mode consistency.
- Webhook endpoint points at production domain.
- Required events enabled.
- Customer portal configured.
- Tax settings decision documented.
- Failed payment/dunning settings reviewed.
- Trial, coupon, and price metadata match app plan mapping.
- Subscription cancellation and entitlement downgrade path exists.

Why this should be a paid upgrade:

- Billing regressions directly cost revenue. This is more valuable than generic SEO polish.

### H. AI Coding And Agent Safety

Hosted/repo scan:

- `.cursorrules`, `AGENTS.md`, Codex instructions, Claude instructions, and repo AI guidance presence.
- Instructions include test/verify commands.
- Instructions warn against destructive git commands.
- Instructions document env/secrets handling.
- Generated-code markers or TODO density in critical paths.
- AI provider references in client bundles.
- Server-side proxy expectation for OpenAI/Anthropic/Replicate/Hugging Face calls.

MCP/local agent checks:

- Ask the local agent to run project-specific verification commands.
- Convert failures into patch-sized tasks.
- Produce "do not touch" constraints from repo instructions.
- Generate a PR checklist and release checklist.

Positioning:

- This is the AI-built-app angle competitors are weaker on: not just "is the code secure", but "can an agent safely continue this project without breaking launch?"

### I. Monitoring And Regression Intelligence

Monitor checks:

- New P0 issue.
- Worsened P1 issue.
- Score drop beyond threshold.
- Checkout-start journey broke.
- Pricing page changed or disappeared.
- Public noindex/robots regression.
- Legal/trust page removed.
- Dependency high/critical vulnerability newly detected.
- GitHub workflow gate disabled.
- Branch protection removed.
- Webhook endpoint missing or failing.

Noise control:

- Alert immediately for P0.
- Require two consecutive failures for transient network/blocking errors.
- Digest P2 changes.
- Group repeated failures by fingerprint.
- Attach "last known good" report and changed checks.

## Execution Modes

### Hosted Public Scan

Safe, no-auth, read-only:

- HTTP GET/HEAD.
- DNS/TXT lookups.
- Public GitHub API.
- Public raw file reads.
- Bounded sitemap/script/source-map fetches.

Use this for free acquisition and public reports.

### Connected GitHub Action Runner

Runs inside the user's repository and CI permissions:

- Install dependencies.
- Run lint/typecheck/test/build.
- Run existing e2e smoke tests.
- Run Deploylint gate against preview or production URL.
- Upload artifacts, JSON, annotations, and PR comments.

Use this for Solo/Builder paid value.

### GitHub App

Uses GitHub API permissions:

- Read branch protection, rulesets, environments, security settings, Dependabot config, code scanning status, and workflow runs.
- Create check runs and PR comments.
- Store repo installation mapping to projects.

Use this when GitHub Action adoption proves demand.

### MCP Local Agent

Runs through the user's local coding environment:

- Scan URL/repo.
- Generate fix plan.
- Ask the agent to run local commands.
- Summarize failures into patch tasks.
- Generate GitHub workflow YAML.

Use this as the agent-native workflow, but keep tools read-only until explicit edit workflows are designed.

## Runnable Quality Gates

Deploylint should distinguish "configured" from "passed".

### JavaScript And TypeScript

Detect and run, in this order, when connected runner or local MCP mode is available:

1. Package manager install: `npm ci`, `pnpm install --frozen-lockfile`, `yarn install --immutable`, or `bun install --frozen-lockfile`.
2. Formatter check when available.
3. Lint command.
4. Typecheck/check command.
5. Unit test command.
6. Production build command.
7. Existing e2e smoke test command.

Framework-specific expectations:

- SvelteKit: `svelte-check`, build, route smoke, Cloudflare adapter output when configured.
- Next.js: typecheck, lint if configured, production build, route smoke.
- Vite SPA: build, preview route smoke, blank-screen/hydration check.
- Astro/Remix/Nuxt: build and route smoke.

### Cloudflare And Edge Apps

Checks:

- Wrangler config parses.
- Bindings in config match expected env type declarations.
- Compatibility date is current enough.
- Durable Object migrations exist for bindings.
- KV/R2/D1 bindings used by code are declared.
- Build output contains Worker entry.
- Source maps are uploaded intentionally, not publicly exposed by the app.

### Test Quality Signals

Static:

- Test files exist.
- Test script is not a placeholder.
- CI runs tests.
- E2E tests exist for app with checkout/auth.
- Coverage command exists, advisory only.

Connected:

- Unit tests pass.
- E2E smoke tests pass.
- Build passes.
- Failing tests are grouped by command and first failure.
- Flaky repeated runs can be marked as "unstable" instead of hard fail in monitoring.

## GitHub Tooling Roadmap

### Stage 1: Composite Action

- Keep action install simple.
- Inputs: URL, mode, min score, report visibility, comment mode.
- Outputs: pass/fail, score, verdict, report URL, JSON path.
- Advisory mode by default for first install.

### Stage 2: GitHub Check Runs

- Create rich check output with conclusion, summary, annotations, and report links.
- Separate URL findings from file-backed repo findings.
- Store check fingerprints so old comments update instead of duplicating.

### Stage 3: GitHub App

- Install app to repos.
- Read repo settings and security posture.
- Link repos to monitored projects.
- Trigger scans on deployment events.
- Comment only on new or worsened findings.

### Stage 4: GitHub-Native Fix Workflow

- Generate issue bodies for non-trivial fixes.
- Generate patch suggestions for deterministic config changes.
- Draft PRs only after explicit approval and narrow scope.
- Never auto-merge.

## Severity Model

Use separate dimensions instead of one flat score:

- Launch blocker: do not share publicly.
- Merge blocker: do not merge this PR.
- Revenue blocker: checkout/billing/subscription risk.
- Trust blocker: legal/security/trust issue likely to hurt conversion.
- Monitoring alert: regression from previous known-good state.
- Polish: useful but not blocking.

Every finding should include:

- `id`.
- `family`.
- `status`.
- `severity`.
- `executionMode`.
- `evidence`.
- `confidence`.
- `fingerprint`.
- `fixPrompt`.
- `docsUrl`.
- `falsePositive`.

This allows the UI, GitHub Action, MCP, and monitoring alerts to use the same finding without flattening everything into a generic checklist.

## Product Differentiators To Market

- "Launch judgment, not generic lint."
- "Checks repo, live URL, checkout, and deploy flow together."
- "Runs your actual lint/test/build in GitHub when connected."
- "Turns findings into Codex/Cursor-ready fix plans."
- "Public summary reports stay safe; private owner reports contain the real repair plan."
- "Billing and checkout readiness, not just uptime."
- "Detects regressions after deploy, not just issues on first scan."

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
