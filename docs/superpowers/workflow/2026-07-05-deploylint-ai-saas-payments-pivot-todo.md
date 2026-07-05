# Deploylint AI-Built SaaS Payments Pivot To-Do

Status: active pivot backlog
Date: 2026-07-05
Direction: A. AI-built SaaS deploy confidence, with B. payments readiness as first paid wedge

## Product Thesis

Deploylint should stop leading with generic check count and start leading with this:

> Before your AI-built SaaS goes public or charges users, Deploylint checks whether it can safely launch, take payments, fulfill access, and recover from billing failures.

## Immediate Credibility Fixes

These should happen before pushing the new positioning hard.

- [ ] Fix Deploylint self-scan `placeholder-copy` false positive caused by our own explanatory copy or scanner pattern.
- [ ] Add a clear contact/support path to the footer and sitemap.
- [ ] Add CSP in report-only mode first, then enforce once Stripe/Plausible/SvelteKit assets are accounted for.
- [ ] Add `apple-touch-icon` and `manifest.webmanifest`.
- [ ] Add SPF and DMARC for `deploylint.com` or document the actual sending domain if different.
- [ ] Investigate why self-scan reported `www.deploylint.com` as unresolved even though it redirects to the apex from local curl.
- [ ] Re-run live self-scan and make the public report clean enough to use as proof.

## Week 1: Demand Test

- [ ] Add a lightweight offer: "AI-built SaaS payment launch audit."
- [ ] Price the manual audit at $49 to $99 for the first five customers.
- [ ] Deliverable: Deploylint scan, payment-readiness brief, prioritized fix prompt, and re-scan after fixes.
- [ ] Create an outreach list of 30-50 recently launched Cursor/Lovable/Bolt/Replit/v0/Claude Code SaaS apps.
- [ ] Reach out with one concrete question: "Want me to check whether this can safely take payments before you launch it publicly?"
- [ ] Track: replies, paid audits, objections, payment setup patterns, and requested recurring features.
- [ ] Kill or revise the wedge if no one will pay or schedule.

## Week 2: Productize Revenue Readiness Checks

### Checkout Start

- [ ] Detect pricing page and paid CTA.
- [ ] Detect checkout routes and provider redirects.
- [ ] Detect Stripe Checkout, Payment Links, Paddle, Lemon Squeezy, and common payment provider signatures.
- [ ] Warn when production-facing copy or bundles expose test-mode payment artifacts.
- [ ] Fail when checkout route returns 404, soft-404, disabled CTA, or server error.

### Webhook Trust Boundary

- [ ] Detect webhook route paths in public repo scans.
- [ ] Detect Stripe webhook signature verification via `stripe.webhooks.constructEvent` or equivalent.
- [ ] Fail subscription/checkout apps with webhook routes but no signature verification.
- [ ] Detect handling for `checkout.session.completed`.
- [ ] Warn when subscription apps do not handle `invoice.paid`, `invoice.payment_failed`, or `customer.subscription.deleted`.
- [ ] Ensure the detection avoids false positives from docs/examples/tests.

### Entitlement And Fulfillment

- [ ] Detect server-side storage of Stripe customer/subscription identity.
- [ ] Warn when fulfillment appears to rely only on checkout success redirects.
- [ ] Detect payment failure and cancellation access-state handling.
- [ ] Warn when no duplicate-event/idempotency guard is visible around fulfillment.

### Customer Self-Service

- [ ] Detect customer portal usage or account billing route.
- [ ] Warn when subscriptions exist but no billing management path is visible.
- [ ] Detect cancellation/refund policy copy on terms/pricing/account pages.
- [ ] Warn when receipts/invoices are not represented by portal, Stripe-hosted invoices, or account page copy.

### Trust And Delivery

- [ ] Require contact/support path for paid products.
- [ ] Require real terms and privacy pages before marking payment readiness as clean.
- [ ] Tie SPF/DMARC warning to receipt/onboarding email risk.
- [ ] Detect analytics events for checkout start/success/cancel where available.

## Week 3: Report And Gate UX

- [ ] Add a "Revenue Readiness" section to scan reports.
- [ ] Show four payment lanes: `Can it charge?`, `Can it fulfill?`, `Can users manage billing?`, `Can support/recovery work?`
- [ ] Make payment blockers more prominent than generic P2 polish warnings.
- [ ] Add a payment-readiness master prompt for coding agents.
- [ ] Add before/after re-scan proof focused on payment blockers fixed.
- [ ] Update `gate-remote.mjs` to fail on revenue blockers in gate mode.
- [ ] Add JSON output fields for revenue blockers and payment readiness summary.
- [ ] Update MCP tool output to expose payment readiness in structured form.

## Positioning And Site Copy

- [ ] Homepage H1: test "Can your AI-built SaaS safely launch and take payments?"
- [ ] Homepage subcopy: mention live URL, public repo, payment flow, deploy gate, and agent-ready fixes.
- [ ] Replace "90+ checks" as the lead proof with "launch + repo + CI + payment readiness."
- [ ] Add or update `/compare` to show how Deploylint differs from WebsiteReady, Preflight.sh, Vibe App Scanner, and VibeEval.
- [ ] Add a focused `/payments` or `/revenue-readiness` page only after the manual offer has signal.
- [ ] Update `/checks` grouping to include "Revenue Readiness."
- [ ] Update `llms.txt`, sitemap, and guides after copy changes.

## Engineering Foundation

- [ ] Keep the current normalized finding model as the foundation.
- [ ] Add `launchImpact` mapping for revenue blockers.
- [ ] Add check IDs for payment readiness before changing UI copy.
- [ ] Use TDD for every new detector.
- [ ] Keep hosted scans read-only.
- [ ] Keep MCP read-only by default.
- [ ] Avoid arbitrary command execution in hosted Workers.
- [ ] Keep external provider checks conservative until false-positive behavior is measured.

## Validation Metrics

- [ ] 3 paid manual audits in 7 days.
- [ ] 5 serious founder replies or calls in 7 days.
- [ ] 50 percent or more of audited apps have at least one real payment-readiness issue.
- [ ] 2 or more users ask for re-scan, CI gate, or recurring monitoring after the audit.
- [ ] Self-scan report has no embarrassing false positives before public promotion.

## Decisions To Make Before Implementation

- [ ] Manual audit price: $49, $79, or $99.
- [ ] First page: homepage pivot vs new `/payments` page.
- [ ] Initial payment providers: Stripe only vs Stripe plus Paddle and Lemon Squeezy.
- [ ] Subscriptions: one-time audits first vs immediate paid monthly plan.
- [ ] Gate behavior: fail only `blocker` revenue findings vs fail blocker plus selected `fix-soon`.
