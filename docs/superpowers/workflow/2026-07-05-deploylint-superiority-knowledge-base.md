# Deploylint Superiority Knowledge Base

Date: 2026-07-05
Status: research baseline before implementation planning
Scope: Deploylint SaaS, repo scanner, GitHub tooling, MCP tooling, monitoring, billing-readiness checks

## Purpose

This document grows the product and technical knowledge base before the next implementation plan. It is not an implementation plan.

Deploylint should win by correlating signals that adjacent tools usually treat separately:

- Repo and package-manager readiness.
- CI quality and GitHub Actions safety.
- Dependency, secret, license, SBOM, and supply-chain posture.
- Live URL launch readiness.
- SEO, social preview, trust, legal, and revenue-flow readiness.
- Synthetic browser checks for login, signup, checkout, and critical API flows.
- Continuous monitoring with history and alerting.
- Agent-ready fix instructions for users working through Codex, Cursor, Claude Code, GitHub Copilot, or MCP clients.

The durable promise is:

> Deploylint tells small teams whether an AI-built SaaS is safe enough to deploy, launch, and charge for, then keeps watching for the failures users would notice first.

## Source Map

| Source family | What it proves | Deploylint implication |
| --- | --- | --- |
| GitHub Advanced Security docs | GitHub already has code scanning, secret protection, Dependabot, dependency review, and SARIF ingestion. | Do not clone GitHub. Detect gaps, ingest/export evidence, and summarize launch impact. |
| GitHub Actions secure-use docs and OWASP CI/CD guidance | Workflow permissions, untrusted code, privileged triggers, actions pinning, and CI/CD boundaries matter. | GitHub Actions hardening should be a first-class launch category, not a hidden security footnote. |
| OpenSSF Scorecard | Security posture can be scored through concrete repo heuristics. | Use individual checks as evidence, but avoid raw aggregate scores as the user-facing truth. |
| OSV-Scanner, Trivy, Semgrep, Snyk | Best-in-class scanners cover dependency, secret, IaC, SAST, license, and code-security domains. | Deploylint should normalize high-signal outputs into a launch queue instead of flooding the report. |
| Checkly and Playwright docs | Synthetic browser and API checks prove real user journeys, not just uptime. | Paid monitoring must verify flows such as signup, login, checkout, webhook health, and dashboard access. |
| Google Search and Web Vitals docs | Search quality includes technical crawl/indexing signals and user-experience metrics. | SEO checks should stay practical: indexing, metadata, social previews, performance, canonical, sitemap, robots, and content quality. |
| Stripe Billing docs | Subscription products require Checkout, webhooks, customer portal, subscription lifecycle handling, and payment-failure flows. | Deploylint can check whether a SaaS can actually charge, recover from failed payment, and let users manage billing. |
| Cloudflare Workers, Queues, Cron, Durable Objects, Browser Run docs | Cloudflare can run scheduled jobs, browser automation, queues/retries, and coordination at the edge. | The platform can support hosted recurring scans and deep browser checks without immediately buying separate infrastructure. |
| MCP and Codex security docs | Tool permissions, prompt injection, sandboxing, read-only mode, and dangerous side effects need explicit boundaries. | Deploylint MCP tools should default to read-only inspection and structured evidence, with clear action boundaries. |

## Market Position

Deploylint should not try to become "Snyk plus Semgrep plus Checkly plus GitHub Advanced Security". That is too broad, too expensive, and too noisy for the buyer.

The buyer is an indie founder or small team building fast with AI. They care less about a full enterprise vulnerability program and more about:

- Will this deploy fail?
- Will checkout work?
- Did AI leave a secret, debug route, or public admin page?
- Will Google and social previews show something embarrassing?
- Will CI actually catch a broken change?
- Can my coding agent fix the highest-impact problems quickly?
- Will I know if this breaks after launch?

Deploylint's product layer should convert many raw signals into one small ordered queue:

- `Block launch`: likely to break deploy, leak secrets, block payment, expose users, or make the app look untrustworthy.
- `Fix soon`: real issue, but not a launch stop for a small alpha.
- `Watch`: hygiene, scale, polish, or future hardening.

## Competitor Capability Map

### GitHub Native Security

Strengths:

- Code scanning and CodeQL.
- Secret scanning and push protection where available.
- Dependabot alerts, security updates, and dependency review.
- SARIF ingestion for third-party findings.
- Branch protection, rulesets, required checks, environments, deployments, and repository security settings.

Opening:

- GitHub tells users what alerts and controls exist. It does not usually answer "can this SaaS launch today?" across repo, CI, live site, billing, SEO, and monitoring.

Deploylint response:

- Detect whether GitHub controls exist.
- Export SARIF only for code-backed findings.
- Use GitHub App permissions later for branch protection, rulesets, environments, secret scanning status, code scanning status, Dependabot status, and required checks.
- Keep hosted public scan useful without GitHub App install.

### Semgrep, Snyk, Trivy, OSV, Scorecard, zizmor

Strengths:

- Strong engines for SAST, SCA, IaC, secrets, GitHub Actions, SBOMs, and open-source security posture.
- Good CI and PR integration surfaces.
- Machine-readable outputs such as JSON, SARIF, CycloneDX, SPDX, and annotations.

Opening:

- They are either specialized or broad security platforms. The user still needs to decide which findings matter before launch.

Deploylint response:

- Start with a small static emulation layer for the highest-signal checks.
- Later run or ingest external engines through a queued/sandboxed path.
- Always map findings into Deploylint-owned rule IDs, launch impact, evidence, confidence, and fix prompts.
- Do not show raw scanner dumps in the main report.

### Checkly And Synthetic Monitoring Tools

Strengths:

- Real browser and API checks.
- Playwright workflows.
- Screenshots, videos, traces, and failure evidence.
- Monitoring-as-code and CI integration.

Opening:

- Synthetic monitors often assume the user already knows what to monitor.

Deploylint response:

- Infer likely critical journeys from the repo and live site.
- Offer templates for SaaS flows: homepage, pricing, signup, login, checkout, account portal, webhook status, dashboard, contact form.
- Store historical pass/fail, screenshots, traces, and changed findings.
- Turn monitors into the reason to subscribe.

### Preflight.sh, Preflyt, WebsiteReady, Vibe App Scanner

Strengths:

- Strong launch-readiness framing.
- Public URL scanning and fix guidance.
- Some are well-aligned with AI-built app risks.

Opening:

- The market is validating the wedge, but still fragmented across URL scanning, repo scanning, fix prompts, and monitoring.

Deploylint response:

- Keep the report more operational: repo plus CI plus live URL plus payment plus monitoring.
- Avoid a generic checklist. The product must show exact evidence and the next fix.
- Treat "free public scan" as acquisition and "continuous confidence" as the paid product.

## Execution Modes

### Hosted Public Scan

Use for:

- Public URL checks.
- Public GitHub repo static checks.
- No-login browser probes.
- Lightweight OSV API checks from lockfiles.
- Static file/config analysis.

Rules:

- No arbitrary command execution.
- No dependency install.
- No private repo content.
- No secrets collected.
- Use SSRF guardrails and public HTTP URL validation.

### GitHub Action

Use for:

- Installing dependencies in the user's own runner.
- Running lint, typecheck, test, build, and e2e commands.
- Uploading a launch gate status.
- Creating PR summaries.
- Producing artifacts and SARIF.

Rules:

- Minimize token permissions.
- Run read-only scans on pull requests.
- Do not require secrets unless a workflow explicitly needs deployment or private package access.
- Keep commands visible and reproducible.

### GitHub App

Use for:

- Branch protection and rulesets.
- Required status checks.
- Environments and deployment protection.
- Security feature status where permissions allow it.
- Private repo scanning later.

Rules:

- Ask for the smallest permission set that unlocks the feature.
- Show a permission rationale in the product.
- Separate read-only repository audit from write/comment/fix actions.

### MCP Tool

Use for:

- Local developer and agent workflows.
- Pre-commit and pre-PR checks.
- Fetching Deploylint report status.
- Asking an agent to apply fix prompts.

Rules:

- Default to read-only tools.
- Name side effects explicitly.
- Return structured findings.
- Do not expose secrets or `.env` contents.
- Avoid arbitrary shell execution in the MCP server; let the user's agent decide and ask approval.

### Deep Hosted Monitor

Use for paid tiers:

- Scheduled scans.
- Playwright journeys.
- Login and checkout flow templates.
- Screenshot/trace evidence.
- Alerting for new, worsened, or resolved critical issues.

Rules:

- Queue jobs.
- Retry with a dead-letter path.
- Keep per-plan budgets.
- Store enough history to prove value without storing sensitive page data by default.

## Check Backlog By Domain

### 1. Repo And Toolchain Readiness

High-value checks:

- Package manager detected and pinned.
- Mixed lockfiles.
- Missing lockfile.
- Placeholder scripts such as `echo "no test"` or `exit 0`.
- Missing `lint`, `typecheck` or `check`, `test`, `build`.
- Script exists but is not wired into CI.
- Node version missing or incompatible.
- TypeScript strictness off or missing for TS apps.
- SvelteKit app without `svelte-check`.
- Framework adapter/config mismatch.
- Monorepo packages with useful scripts but no root orchestrator.

Paid-worthy connected checks:

- Install dependencies.
- Run lint.
- Run typecheck.
- Run tests.
- Run build.
- Run existing Playwright/Cypress smoke tests.
- Capture failure excerpts and turn them into a fix queue.

### 2. GitHub Actions And CI/CD Safety

High-value checks:

- No CI workflow.
- CI does not run on pull requests.
- CI does not run lint/typecheck/test/build.
- Workflow permissions omitted or too broad.
- `permissions: write-all`.
- Dangerous `pull_request_target` patterns.
- Untrusted GitHub context interpolated into shell.
- Third-party actions pinned to moving refs.
- Self-hosted runner used on public PR workflows.
- Artifact upload with broad path globs.
- Cache keys include untrusted input.
- Deployment workflow lacks protected environment.
- Dependabot does not update GitHub Actions.
- CODEOWNERS absent for `.github/workflows` in team repos.

Later engine:

- zizmor for deeper GitHub Actions static analysis.
- Scorecard or Scorecard-inspired checks for token permissions, maintained status, branch protection, binary artifacts, security policy, and dependency updates.

### 3. Dependency, CVE, License, And SBOM Readiness

High-value checks:

- OSV-backed vulnerabilities from lockfiles.
- High/critical runtime CVEs grouped by package and fixed version.
- Dependency update automation absent.
- Dependency review workflow absent for GitHub PRs.
- Risky license families in direct dependencies.
- Lockfile cannot be parsed.
- Existing SBOM detected but invalid or stale.
- No SBOM/provenance claim while release docs imply supply-chain guarantees.
- Git/tarball/file dependencies.
- Registry override in `.npmrc`.
- Suspicious postinstall scripts where lockfile metadata exposes them.

Later engines:

- OSV-Scanner for multi-ecosystem dependency and SBOM inputs.
- Trivy for filesystem, secret, license, dependency, IaC, and container signals.
- CycloneDX/SPDX validation.

Product stance:

- CVE count is not the product. Launch impact, affected surface, fixed version, and first fix are the product.

### 4. App Security Footguns For AI-Built SaaS

High-value checks:

- Public `.env`, `.git`, backups, SQLite/db dumps, source maps, debug logs.
- Secrets in sampled JS bundles or repository text.
- Missing webhook signature verification for Stripe-like handlers.
- Wide-open CORS.
- Public admin routes.
- Demo credentials.
- Missing rate limits on auth, forms, checkout, and API write surfaces.
- Missing CSRF posture for cookie-auth apps.
- Dangerous `eval`, dynamic function construction, or shell execution in server code.
- SSRF risk around user-controlled fetch/proxy/image routes.
- Supabase apps with visible client config and no clear RLS guidance.
- Auth middleware absent for obvious dashboard/account/admin route structures.

Later engines:

- Semgrep-style rules for framework-specific patterns.
- CodeQL/Semgrep passthrough detection and result normalization.

### 5. Deployment And Runtime Configuration

High-value checks:

- Wrangler, Vercel, Netlify, Docker, Compose, Terraform, Pulumi, Kubernetes, Fly, Railway, Render, Supabase, Firebase, or Amplify config detected.
- Cloudflare `compatibility_date` stale.
- Worker bindings exist but env documentation is missing.
- Dockerfile copies `.env`.
- Docker runs as root.
- Missing health endpoint.
- No preview/prod env separation.
- No rollback or release notes path.
- Deploy workflow lacks environment protection.
- No production smoke step after deploy.
- Missing `security.txt` for mature public SaaS.

Paid-worthy connected checks:

- Safe config parse.
- Framework build artifact exists.
- Optional deployment dry-run where platform supports it.
- Post-deploy smoke against the production URL.

### 6. Live Site Launch Surface

High-value checks:

- HTTP reachability, redirect chain, status, and final URL.
- HTTPS, HSTS, CSP, X-Frame-Options/frame-ancestors, MIME sniffing, referrer policy, permissions policy.
- Mixed content.
- Cookie security flags where cookies are present.
- Form actions and insecure submission targets.
- Canonical, title, description, H1, language, viewport.
- Robots and `noindex` mistakes.
- Sitemap discovery.
- Open Graph and Twitter/X card metadata.
- Social image URL returns a real image with correct content type.
- Pricing, contact, privacy, terms, refund/cancellation policy for paid SaaS.
- Placeholder copy, default framework text, stale copyright.
- Broken links.
- Large page weight, render-blocking resources, image dimensions, lazy loading.
- Core Web Vitals proxy/lab signals where feasible.

Paid-worthy checks:

- Multi-page crawl.
- Historical diff.
- Alert when a page becomes noindexed, payment CTA disappears, social image breaks, or security headers regress.

### 7. Revenue And Subscription Readiness

High-value checks:

- Pricing page exists.
- Checkout route/API exists.
- Stripe Checkout or Payment Element integration detected.
- Webhook endpoint detected.
- Webhook signature verification detected.
- Customer portal or billing-management route detected.
- Subscription lifecycle events handled, especially subscription created/updated/deleted and invoice/payment failure events.
- Test mode accidentally present in production copy/config.
- Cancellation/refund terms reachable.
- Post-checkout success/cancel URLs exist.

Paid-worthy checks:

- Synthetic checkout path in test mode or controlled live mode.
- Webhook health endpoint or event receipt check.
- Alert when checkout button, pricing page, or billing portal breaks.

### 8. Monitoring And Regression History

High-value checks:

- Snapshot critical findings.
- Diff new, worsened, resolved, and unchanged findings.
- Notify only on launch blockers and high-confidence security/revenue regressions.
- Track uptime separately from synthetic journey pass/fail.
- Store screenshots/traces for paid deep checks.
- Group noisy repeated failures.

Initial monitor templates:

- Homepage reachable.
- Pricing page reachable.
- Signup page reachable.
- Login page reachable.
- Checkout button path starts.
- Billing portal reachable.
- Contact form does not 500.
- Primary app dashboard is protected from anonymous users.

### 9. MCP And Agent Safety

High-value checks:

- MCP server exposes read-only scan/report tools first.
- Tool descriptions clearly disclose network access and side effects.
- Tools do not return `.env` values or secret snippets.
- Fix prompts are structured for agents but require explicit user approval for writes.
- MCP config docs include least-privilege examples.
- Local agent workflow can run `deploylint_scan`, then optionally apply one fix, then rerun.

Risk controls:

- Treat prompt injection from repository files and live pages as untrusted input.
- Separate "scan" from "act".
- Avoid "run arbitrary command" as a hosted or MCP primitive.
- Include evidence IDs so an agent can cite the issue it is fixing.

## Paid Product Shape

Free alpha should remain useful:

- Public URL scan.
- Public GitHub repo scan.
- Core launch report.
- Basic fix prompts.
- Honest alpha messaging.

Future paid tier should sell continuity, not just more checks:

- Saved projects.
- Monitored URLs/repos.
- Recurring scans.
- CI gate and PR summaries.
- Security/revenue regression alerts.
- Report history.
- Synthetic journey checks.
- Higher crawl budgets.
- More detailed agent-ready fix packs.

Suggested eventual tiers:

- Free: public scans, limited history, limited crawl, alpha/beta limitations.
- Builder: low monthly price, saved projects, recurring monitors, CI gate, history, alerts.
- Pro: private repos, GitHub App settings audit, SARIF export, more monitors, Slack/webhook alerts, deeper browser checks.

Do not enable billing gates until the free-vs-paid boundary is technically enforced and users can see usage clearly.

## Architecture Implications

Near-term architecture:

- Keep hosted scans pure and read-only.
- Add a normalized internal finding model before adding more engines.
- Preserve the current public report shape until a versioned API is ready.
- Treat every external scanner as an evidence provider, not the product owner.
- Add source engine, rule ID, confidence, launch impact, evidence locations, references, and fix prompt IDs.

Cloudflare path:

- Workers handle lightweight scan APIs.
- Queues handle scan jobs, retries, and dead-letter failures.
- Cron triggers schedule monitors.
- Durable Objects coordinate per-target or per-account state where needed.
- D1 or KV stores target metadata, scan snapshots, and history depending on query needs.
- R2 stores larger artifacts such as screenshots, traces, and HTML snapshots when paid deep monitoring ships.
- Browser Run/Playwright powers screenshots and synthetic journeys.

GitHub path:

- Hosted public repo scan remains first.
- GitHub Action runs real commands in the user's runner.
- GitHub App comes later for settings, private repo access, PR comments, and required checks.
- SARIF export comes after the internal finding model has stable file-backed locations.

MCP path:

- Keep local tools focused: scan, gate, explain, export summary, map finding to fix prompt.
- Avoid hidden side effects.
- Let the user's coding agent apply changes with normal approval flows.

## What Not To Build Yet

- Full enterprise AppSec dashboard.
- Organization-wide policy engine.
- Auto-fix PRs before findings and prompts are stable.
- Arbitrary hosted code execution.
- Private repo cloning before GitHub App permissions, storage, and retention policy are clear.
- Broad Slack/email notification system before alert quality is high.
- Dozens of low-signal SEO pages or thin keyword landing pages.
- A raw scanner-results UI.

## Research Questions To Resolve Before Implementation

- Which storage product should hold monitor history once query needs are clear: KV only, D1, or hybrid KV plus R2?
- What exact GitHub App permissions are necessary for the first settings audit?
- Which public repo APIs are rate-limited hardest in production and need caching?
- What is the smallest SARIF subset GitHub code scanning accepts for Deploylint findings?
- Which Playwright journeys can be generated safely from site structure without credentials?
- How much screenshot/trace retention is useful enough to sell but cheap enough for the first paid tier?
- Which subscription price has the best early conversion signal: one cheap plan, one-time report, or free alpha plus waitlist?

## Implementation Direction After This Research

The next plan should not try to ship everything. The strongest sequence is:

1. Normalize findings and launch-impact scoring.
2. Deepen static repo and GitHub Actions checks.
3. Add security/revenue snapshot diffs for monitoring.
4. Add alpha monitor storage and scheduled rescans.
5. Add the first paid-worthy synthetic checks.
6. Add GitHub Action gate.
7. Add GitHub App settings audit.
8. Add SARIF export and PR summaries.

This order keeps Deploylint useful now while building toward the subscription reason: continuous launch confidence.

## Sources

- GitHub Advanced Security overview: https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security
- GitHub dependency review: https://docs.github.com/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
- GitHub code scanning and SARIF: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning
- OWASP CI/CD Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html
- OpenSSF Scorecard: https://scorecard.dev/
- OpenSSF Scorecard checks: https://github.com/ossf/scorecard/blob/main/docs/checks.md
- OSV-Scanner output docs: https://google.github.io/osv-scanner/output/
- Trivy filesystem scanning: https://trivy.dev/docs/latest/target/filesystem/
- Trivy secret scanning: https://trivy.dev/docs/latest/scanner/secret/
- Trivy misconfiguration scanning: https://trivy.dev/docs/latest/scanner/misconfiguration/
- zizmor docs: https://docs.zizmor.sh/
- Semgrep PR comments: https://docs.semgrep.dev/semgrep-appsec-platform/github-pr-comments
- Snyk IaC security: https://snyk.io/product/infrastructure-as-code-security/
- Checkly synthetic monitoring: https://www.checklyhq.com/product/synthetic-monitoring/
- Playwright trace viewer: https://playwright.dev/docs/trace-viewer
- Playwright CI: https://playwright.dev/docs/ci
- Google Core Web Vitals and Search: https://developers.google.com/search/docs/appearance/core-web-vitals
- Web Vitals overview: https://web.dev/articles/vitals
- Lighthouse CI: https://github.com/GoogleChrome/lighthouse-ci
- Stripe Checkout subscriptions: https://docs.stripe.com/payments/checkout/build-subscriptions
- Stripe webhooks: https://docs.stripe.com/webhooks
- Stripe customer portal: https://docs.stripe.com/customer-management
- Stripe subscription webhooks: https://docs.stripe.com/billing/subscriptions/webhooks
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Cloudflare Queues: https://developers.cloudflare.com/queues/
- Cloudflare Dead Letter Queues: https://developers.cloudflare.com/queues/configuration/dead-letter-queues/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Cloudflare Browser Run: https://developers.cloudflare.com/browser-run/
- Cloudflare Browser Run Playwright: https://developers.cloudflare.com/browser-run/playwright/
- Cloudflare Browser Run with Durable Objects: https://developers.cloudflare.com/browser-run/how-to/browser-run-with-do/
- MCP authorization: https://modelcontextprotocol.io/specification/draft/basic/authorization
- MCP security best practices: https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices
- OpenAI Codex approvals and security: https://developers.openai.com/codex/agent-approvals-security
- OpenAI Codex permissions: https://developers.openai.com/codex/permissions
- Preflight.sh documentation: https://preflight.sh/documentation/
- Preflyt about: https://preflyt.dev/about
- WebsiteReady: https://websiteready.org/
- Vibe App Scanner AI fixes: https://vibeappscanner.com/products/ai-fixes
