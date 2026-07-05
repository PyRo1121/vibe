# Deploylint Final Pre-Plan Review

Date: 2026-07-05
Status: final research review before implementation planning
Tracks covered: competitor/current-doc refresh, paid wedge validation, implementation readiness
Tracks intentionally skipped: full repo reality check

## Executive Decision

Do one more implementation plan, then build. Do not keep researching after this pass unless a specific implementation blocker appears.

The current research strengthens the Deploylint thesis, but it also raises the bar. Vibe App Scanner already positions around vibe-coded app security, MCP fixes, and continuous protection. Preflight.sh already owns a codebase launch-readiness CLI with optional hosted history and AI suggestions. WebsiteReady already owns a polished public launch-checker flow for indie makers.

Deploylint can still win, but not by being another live URL security scanner. The defensible wedge is:

> Repo + CI + live site + billing + monitoring launch confidence for AI-built SaaS.

The next build slice should make Deploylint materially better at deciding whether a SaaS can ship today, then set up monitoring as the subscription reason.

## Track 2 - Current Docs And Competitor Refresh

### GitHub Native Security Is Too Strong To Clone

Current GitHub docs confirm that GitHub already owns several primitives Deploylint should integrate with instead of replacing:

- Secret scanning scans repository history and related GitHub surfaces for hardcoded credentials.
- Dependency review shows dependency changes, vulnerability data, release dates, and can block vulnerable dependency changes through the dependency review action.
- Code scanning accepts SARIF 2.1.0 through GitHub Actions, the code scanning API, or CodeQL CLI.
- GitHub Actions security guidance explicitly recommends least-privilege `GITHUB_TOKEN` permissions, warns about script injection, and calls out privileged `pull_request_target` and `workflow_run` patterns.

June 2026 GitHub changes make Actions security even more current: `actions/checkout@v7` now refuses common `pull_request_target` pwn-request checkout patterns by default, and GitHub plans to backport enforcement to supported major versions on July 16, 2026.

Implication:

- Deploylint should ship Actions checks now, but keep them current with GitHub behavior.
- `pull_request_target` should not be a dumb fail. It should fail when the workflow checks out or executes untrusted code in a privileged context, uses opt-out flags, or fetches fork refs through shell/CLI.
- SARIF should wait until Deploylint has file-backed findings with stable rule IDs.

### Scanner Engines Are Evidence Providers, Not Product Strategy

OSV-Scanner provides vulnerability output with OSV URL, CVSS, ecosystem, package, version, fixed version, and source lockfile/SBOM path. It supports table, JSON, SARIF, SPDX, and CycloneDX formats.

Trivy supports JSON, SARIF, SBOM, and GitHub dependency snapshot outputs across vulnerability, misconfiguration, secret, and license scanners.

OpenSSF Scorecard includes branch protection, code review, token permissions, dangerous workflows, dependency updates, security policy, and other posture checks.

zizmor is a focused static analyzer for GitHub Actions security issues.

Implication:

- Build a Deploylint-owned internal finding model first.
- Map external engine output into `ruleId`, `sourceEngine`, `confidence`, `launchImpact`, `evidence`, `fixPromptId`, and `references`.
- Do not expose raw OSV, Trivy, Scorecard, Semgrep, or zizmor dumps in the main report.
- Do not add heavy CLI execution to the Worker-hosted public scanner.

### Pricing Shows Room Below Enterprise AppSec

Current official pricing signals:

- GitHub Code Security is listed at $30 per active committer/month; Secret Protection has free push protection for public repositories and included Team/Enterprise coverage in the GitHub plans page.
- Semgrep Teams starts at $30/month/contributor for Code or Supply Chain, with Secrets at $15/month/contributor, and a free edition up to 10 contributors.
- Snyk Team starts at $25/month per contributing developer.
- Checkly bills synthetic monitoring by check runs. The Hobby plan includes 10,000 API and 1,000 browser check runs per month, while Starter overages are listed at $6.50 per 1,000 browser runs and $2.60 per 10,000 API runs.

Implication:

- A $9-$19/month indie plan is plausible only if it sells a narrower outcome than these tools: deploy confidence for one small SaaS.
- Do not price against enterprise AppSec features. Price against "would I pay to avoid one embarrassing broken launch or checkout failure?"
- Browser monitoring must be budgeted carefully. Every plan needs explicit monitor/run limits before paid checkout goes live.

### Direct Wedge Competitors Are Real

Refreshed competitor signals:

- Vibe App Scanner sells "vibe-coded app" security, exact fixes over MCP or copy-paste, Starter Scan at $5, Deep Scan at $19, and Continuous Protection at $29/month.
- Preflight.sh is a Go CLI for codebase launch readiness, supports npm/Homebrew/Go/Docker/curl installation, CI JSON output, specific check filtering, ignored checks, an agent skill, and optional hosted scan history with AI fix suggestions.
- Preflyt is a no-signup live exposure scanner for exposed `.env`, `.git`, backups, source maps, database files, open ports, debug/admin panels, headers, CORS, cookie flags, and server leakage.
- WebsiteReady offers a no-signup launch checker with GO/CONDITIONAL/NO-GO-style severity, P0/P1/P2 evidence, launch SEO, trust pages, sitemap, robots, AI readiness, llms.txt, and developer-ready prompts.

Implication:

- Deploylint must not lead with "we scan live apps for security." That is crowded.
- Deploylint should lead with "we check the whole deploy path: repo, CI, live site, checkout, and monitoring."
- MCP is table stakes in this space, not a moat.
- Continuous monitoring is validated, but a $29/month competitor already exists. Deploylint's low-end plan should be cheaper or more developer-workflow focused.

### Cloudflare Can Support The First Paid Version

Current Cloudflare docs confirm a practical hosted architecture:

- Browser Run runs headless Chrome on Cloudflare's global network and supports screenshots, PDFs, snapshots, links, structured data, crawling, Puppeteer, Playwright, CDP, and Playwright MCP-style use cases.
- Queues integrate with Workers, support batching/retries/delays, and dead-letter queues.
- Cron Triggers can schedule recurring scan dispatch.
- Durable Objects can coordinate stateful monitor or account-level concurrency.

Implication:

- We can build alpha monitoring on Cloudflare before moving to separate infrastructure.
- Browser Run should power paid deep checks, not every free scan.
- Queues and DLQs are required before recurring scans become paid, otherwise failed scans become support debt.

### Stripe Subscription Readiness Is A Product Check Family

Stripe subscription docs reinforce the billing-readiness check family:

- Subscriptions involve lifecycle states, invoices, payment collection, updates, and cancellations.
- Webhooks must handle subscription status changes and payment failures.
- Stripe explicitly says to verify incoming webhook events.
- Customer portal covers payment method, invoice, subscription, and cancellation management.

Implication:

- Billing readiness is a strong Deploylint differentiator against generic security tools.
- Detect checkout without webhook verification as a launch blocker.
- Detect subscriptions without customer portal or billing-management route as `fix soon`.
- Detect pricing/checkout pages with no accessible refund/cancellation terms as a launch trust issue.

### MCP And Agent Safety Must Be A Constraint

MCP security docs call out authorization, token passthrough, SSRF, malicious authorization endpoints, and command injection. OpenAI Codex docs also emphasize sandboxing, least-privilege permissions, and prompt-injection caution.

Implication:

- Deploylint MCP should be read-only by default.
- Avoid "run arbitrary command" as a Deploylint MCP primitive.
- Tool outputs should be structured and evidence-based.
- Tool descriptions must clearly disclose side effects.
- Fix application should remain in the user's coding agent/editor approval flow.

## Track 3 - Paid Wedge Validation

### What Should Stay Free

Free is the acquisition channel. It should produce trust and shareable output without requiring setup.

Keep free:

- Public URL scan.
- Public GitHub repo static scan.
- Core launch score.
- Basic evidence and fix prompts.
- Limited report history or local/session report access.
- Clear alpha messaging while unstable.

Do not hide the core findings during alpha. If the product looks paywalled before it proves value, it will undercut user trust.

### What Is Actually Worth Paying For

Users are unlikely to pay monthly for "more checklist items." They will pay for recurrence, private context, and workflow integration.

Subscription-worthy:

- Saved projects.
- Recurring scans.
- New/worsened/resolved issue history.
- CI launch gate.
- PR summaries.
- Email/webhook/Slack alerts.
- Synthetic browser journeys.
- Checkout and billing-flow monitoring.
- Private GitHub repo scans.
- GitHub App settings audit.
- SARIF export.
- Higher crawl and browser-run budgets.

Most defensible paid promise:

> Tell me when my SaaS becomes unsafe to deploy, hard to trust, or unable to charge customers.

### Suggested Pricing Boundary

Keep the free alpha.

When billing is enabled, use one simple paid plan first:

- `Builder` at $19/month.
- 3 saved projects.
- Weekly recurring scan per project.
- 1 synthetic browser journey per project.
- 25 manual full scans/month.
- Report history and diffs.
- CI launch gate.
- Email alerts.

Defer the $9 plan unless users push back on $19. Vibe App Scanner already anchors continuous protection at $29/month. Deploylint at $19 can feel cheaper while still leaving room for browser-run costs.

Later:

- `Solo` at $9/month if conversion is weak or if it is limited to saved history and recurring static scans without browser journeys.
- `Pro` at $39/month for private repos, GitHub App settings audit, SARIF, Slack/webhook alerts, more projects, and more browser checks.
- One-time deep report at $19-$49 as a non-subscription fallback.

### Paid Wedge Kill Criteria

Do not force subscriptions if:

- Users do not save projects after free scans.
- Users do not rerun scans after fixes.
- Users do not click or copy fix prompts.
- Users do not connect CI or ask for monitoring.
- Monitoring alerts are noisy or unactionable.

If those signals are weak, sell one-time reports before subscriptions.

## Track 4 - Implementation Readiness

### Recommended Next Build Slice

Build this first:

> Normalized finding model plus launch-impact scoring for repo, CI, dependency, billing, and live-site findings.

Why:

- Every later feature needs it: SARIF, PR summaries, monitoring diffs, alerting, paid history, MCP evidence, external scanner adapters.
- It reduces noise before adding more checks.
- It gives the UI a sharper "block launch / fix soon / watch" model.
- It avoids locking the app into the current flat `ScanCheck` shape.

### Next Plan Scope

The next implementation plan should be one cohesive slice:

1. Add internal normalized findings.
2. Convert current repo/live checks into normalized findings internally.
3. Preserve existing public report compatibility at the boundary.
4. Add launch-impact scoring.
5. Add static checks that are cheap and high signal:
   - dependency review action missing,
   - Dependabot/Renovate missing,
   - `pull_request_target` privileged checkout/execution patterns,
   - `actions/checkout` unsafe opt-out flag,
   - broad workflow token permissions,
   - webhook signature missing for Stripe-like integrations,
   - customer portal/billing management missing,
   - CI quality gates missing,
   - health endpoint missing,
   - missing security policy.
6. Add test coverage for mapping, scoring, and compatibility.

### Build Immediately After That

Second slice:

- Security/revenue snapshot diff engine.
- Monitor target storage with alpha-free plan shape.
- Scheduled scan dispatcher behind a safe batch limit.
- No external alert delivery until diff quality is stable.

Third slice:

- GitHub Action launch gate.
- PR markdown summary.
- Optional SARIF export only for file-backed findings.

Fourth slice:

- Browser Run synthetic journey alpha:
  - homepage,
  - pricing,
  - signup/login route render,
  - checkout-start route,
  - dashboard protected/unprotected expectation,
  - contact/waitlist dry-run.

### Explicit Deferrals

Do not build these next:

- GitHub App private repo access.
- Auto-fix PRs.
- Broad Semgrep/Snyk/Trivy clone.
- Hosted arbitrary command execution.
- Organization dashboards.
- Slack/webhook alerts before email/internal alert quality is proven.
- Full browser journey authoring UI.
- Complex annual billing.

### Acceptance Criteria For The Next Plan

The next implementation plan is ready only if it includes:

- Exact files to touch.
- Internal finding type definition.
- Compatibility strategy for existing report UI/API/MCP.
- Launch-impact mapping table.
- Check IDs and messages.
- Tests for scoring and old report compatibility.
- Verification commands, including `npm.cmd run verify:preflight`.
- A rollback path if normalized findings complicate the report.

## Final Recommendation

Proceed to implementation planning for:

> Deploylint normalized findings and launch-impact scoring, plus the first high-signal repo/CI/billing checks.

This is the highest-leverage foundation. It improves the free product now, creates the paid monitoring model later, and lets Deploylint differentiate from Vibe App Scanner, Preflight.sh, Preflyt, WebsiteReady, GitHub Advanced Security, Semgrep, Snyk, OSV, Trivy, Scorecard, zizmor, and Checkly without trying to replace them.

## Sources

- GitHub Advanced Security plans: https://github.com/security/plans
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub safer `pull_request_target` checkout defaults: https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout/
- GitHub dependency review: https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review
- GitHub SARIF code scanning: https://docs.github.com/en/code-security/concepts/code-scanning/sarif-files
- GitHub secret scanning: https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning
- Semgrep pricing: https://semgrep.dev/pricing/
- Snyk pricing: https://snyk.io/plans/
- Checkly pricing: https://www.checklyhq.com/pricing/
- Checkly Playwright Check Suites: https://checklyhq.com/docs/detect/synthetic-monitoring/playwright-checks/quickstart
- Playwright trace viewer: https://playwright.dev/docs/trace-viewer
- OSV-Scanner output: https://google.github.io/osv-scanner/output/
- Trivy reporting: https://trivy.dev/docs/latest/configuration/reporting/
- OpenSSF Scorecard checks: https://github.com/ossf/scorecard/blob/main/docs/checks.md
- zizmor docs: https://docs.zizmor.sh/
- Cloudflare Browser Run: https://developers.cloudflare.com/browser-run/
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Stripe subscription webhooks: https://docs.stripe.com/billing/subscriptions/webhooks
- Stripe customer portal: https://docs.stripe.com/customer-management
- MCP security best practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- OpenAI Codex approvals and security: https://developers.openai.com/codex/agent-approvals-security
- Preflight.sh repository/docs: https://github.com/preflightsh/preflight
- Preflyt about: https://preflyt.dev/about
- WebsiteReady: https://websiteready.org/
- Vibe App Scanner: https://vibeappscanner.com/
