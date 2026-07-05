# Deploylint AI-Built SaaS Deploy Confidence Pivot Design

Status: ready for user review
Date: 2026-07-05
Owner: Deploylint

## Executive Decision

Keep the Deploylint name and pivot the product promise from generic website launch checking to:

> Deploylint is deploy confidence for AI-built SaaS.

The first paid wedge is:

> Can this AI-built SaaS safely take money?

This preserves most current scanner assets while moving the product away from the crowded "SEO/security/launch checklist" lane. The current scanner remains the free acquisition engine. The paid product should focus on payment readiness, deploy gates, and recurring confidence for small SaaS teams shipping with Cursor, Lovable, Bolt, Replit, v0, Claude Code, and similar tools.

## Why Pivot

The generic market is crowded:

- WebsiteReady already owns a no-signup public launch audit flow with GO/CONDITIONAL/NO-GO severity, AI readiness, and developer prompts.
- Preflight.sh owns codebase launch readiness through CLI, CI JSON output, agent skills, hosted history, and AI fix suggestions.
- Vibe App Scanner and similar tools own URL-first "vibe-coded app security" messaging, exposed secrets, Supabase/Firebase checks, MCP, and continuous protection.
- VibeEval frames the category as a growing 2026 scanner market with many AI-codegen-specific entrants.

The pain is still real:

- AI-built apps repeatedly ship with exposed secrets, weak auth, open data, missing security controls, and unreviewed deploy paths.
- Axios reported real exposed data from AI-built apps and described basic security mistakes being copied at speed.
- Stripe readiness is a sharper and more urgent buyer problem than "more checks": if checkout, webhooks, customer access, receipts, and cancellation paths fail, the founder loses money and trust immediately.

## Product Positioning

Old center:

> Run 90+ checks before posting your URL.

New center:

> Before your AI-built SaaS goes public or charges users, Deploylint checks whether the deploy path, payment flow, repo, CI, and trust surface are safe enough.

Primary buyer:

- Solo founders and small teams shipping paid web apps with AI coding tools.
- Builders with a live URL and a public or shareable GitHub repo.
- People about to launch, post publicly, enable Stripe, or merge payment-related changes.

Primary job:

- "Tell me if this thing can safely launch and take money."

Secondary jobs:

- "Give me the exact fix prompt for my coding agent."
- "Block a deploy if a payment or launch blocker regresses."
- "Prove the score improved after I fix it."

## First Paid Wedge

### AI-Built SaaS Payment Readiness Audit

Paid promise:

> Deploylint finds the launch blockers that can stop an AI-built SaaS from charging users correctly.

This should be sold before it is overbuilt:

- Manual audit offer: $49 to $99.
- Target: founders with live AI-built SaaS apps, pricing pages, waitlists, or Stripe checkout in progress.
- Deliverable: a Deploylint report plus a short "safe to charge" brief.
- Validation target: 5 paid audits or strong buyer objections within 7 days.

If the manual audit does not sell, do not add subscription complexity.

## Payment Readiness Check Families

### Checkout Start

Purpose: prove users can start a payment flow without broken routes or fake pricing.

Checks:

- Pricing page exists and is reachable.
- Primary paid CTA is visible and clickable.
- Checkout route does not 404, soft-404, or show placeholder copy.
- Stripe Checkout, Payment Links, Paddle, Lemon Squeezy, or equivalent provider is detected.
- Checkout button is not disabled by missing env variables in production.
- Checkout errors are user-readable and do not leak stack traces.
- Test-mode warning if obvious `pk_test_`, `sk_test_`, or test checkout artifacts appear in production-facing copy or client bundles.

### Webhook Trust Boundary

Purpose: catch the most dangerous payment integration mistake: accepting payment events without verifying authenticity.

Checks:

- Webhook route exists when checkout/subscription code exists.
- Stripe webhook signature verification is present (`stripe.webhooks.constructEvent`, `constructEventAsync`, equivalent raw-body signature path).
- Webhook secret is referenced through server env, not client code.
- Webhook endpoint handles `checkout.session.completed`.
- Subscription apps handle ongoing events such as `invoice.paid`, `invoice.payment_failed`, and `customer.subscription.deleted`.
- Webhook route does not accept GET as a success path.
- Webhook handler returns 2xx only after validation and safe processing.

### Entitlement And Fulfillment

Purpose: prove payment creates access and failed payment removes or limits access.

Checks:

- App stores Stripe customer or subscription identity server-side.
- Checkout completion is not the only source of truth if subscriptions are used.
- Access state is updated from webhook events.
- Payment failure path is represented in code or product copy.
- Subscription cancellation/deletion path removes or changes access.
- Idempotency or duplicate-event tolerance is present in fulfillment logic where detectable.

### Customer Self-Service

Purpose: reduce support burden and refund disputes.

Checks:

- Customer portal or billing-management route is present for subscription apps.
- Users can update payment method or view/manage subscription.
- Cancellation path is linked from account, settings, billing, or terms.
- Refund/cancellation terms are reachable before checkout.
- Receipts/invoices path is handled by Stripe-hosted invoices, customer portal, or app account page.

### Trust And Deliverability

Purpose: payment apps need more than a working checkout button.

Checks:

- Contact/support path exists.
- Terms and privacy pages are real and reachable.
- Refund/cancel policy is present for paid products.
- Email auth has SPF and DMARC on the sending or brand domain.
- Security headers do not break checkout redirects.
- Analytics or event tracking captures checkout-start and checkout-result events without requiring invasive cookies.

## Deploy Confidence Check Families

Payment readiness is the first paid wedge. The broader Deploylint product still covers:

- Live URL launch readiness: indexing, previews, trust pages, security headers, exposed files, broken links, placeholder copy.
- Public repo readiness: env leakage, scripts, lockfiles, dependency CVEs, license risk, package-manager drift.
- CI readiness: build/test/typecheck/lint gates, dependency review, unsafe workflow permissions, risky `pull_request_target`, broad deploy triggers.
- Agent readiness: MCP and structured fix prompts for coding agents.
- Re-scan proof: before/after score, fixed/regressed checks, report history.
- Later monitoring: saved projects, scheduled scans, diff alerts, and synthetic checkout journeys.

## Product Surface Changes

### Homepage

Change the hero from generic "90+ launch checks" to:

> Can your AI-built SaaS safely launch and take payments?

Support copy should mention:

- Live URL + public repo scan.
- Payment, deploy, trust, and security blockers.
- Fix prompts for Cursor/Claude Code.
- Free launch scan, paid payment readiness audit.

### Report

Add a clear payment readiness lane:

- `Can it charge?`
- `Can it fulfill access?`
- `Can users manage billing?`
- `Will receipts/support work?`

The current GO/CONDITIONAL/NO-GO model remains, but payment blockers should be more visible than generic P2 polish.

### Checks Catalog

Group payment checks under "Revenue Readiness" instead of burying them inside generic launch/security categories.

### Compare Page

Stop leading with broad check count. Lead with the difference:

- Deploylint checks launch + repo + CI + payment readiness together.
- WebsiteReady is strong at public website launch checks.
- Preflight.sh is strong at local codebase/CLI readiness.
- Vibe App Scanner is strong at URL-first security for AI-built apps.
- Deploylint's wedge is "safe to launch and charge users."

### Developers Page

Make the CI gate story payment-aware:

- Block deploys when checkout/webhook/payment readiness regresses.
- Output JSON/markdown that can become a PR comment.
- Keep MCP read-only by default.

## Data Model Direction

The existing normalized finding model remains the right foundation. Each payment finding should carry:

- `id`
- `category`
- `status`
- `priority`
- `launchImpact`
- `evidence`
- `source`
- `confidence`
- `fixPromptId`
- `references`

Payment-specific launch impacts:

- `blocker`: checkout cannot start, webhook verification missing, client-side secret, no fulfillment path.
- `fix-soon`: no customer portal, missing cancellation copy, incomplete payment failure handling.
- `watch`: pricing copy mismatch, analytics missing, limited receipt visibility.

## Validation Plan

### Week 1: Manual Revenue Test

Goal: learn whether founders will pay for the narrower wedge.

Steps:

1. Create a simple offer page or section: "AI-built SaaS payment launch audit."
2. Price it at $49 to $99.
3. Offer 5 slots.
4. Reach out to 30-50 builders who recently shipped with Cursor, Lovable, Bolt, Replit, v0, or Claude Code.
5. Deliver audits manually using the current scanner plus the payment-readiness checklist.
6. Track payment, objections, and requested follow-up features.

Pass criteria:

- 3+ paid audits, or
- 5+ serious calls/replies from founders who have payment readiness pain.

Fail criteria:

- Builders like the idea but will not pay or schedule.
- Most prospects only want a free SEO/security scan.
- No one has Stripe/payment readiness urgency.

### Week 2: Productize The Highest-Signal Checks

Build only checks that appeared in manual audits:

- Webhook signature detection.
- Customer portal/billing route detection.
- Refund/cancellation copy detection.
- Checkout CTA/start detection.
- Payment event handling detection.
- Live-domain self-scan credibility fixes.

### Week 3: Gate And Re-Scan Proof

Make payment readiness actionable:

- Add report lane.
- Add master fix prompt for payment blockers.
- Add deploy gate output.
- Add re-scan diff proof.

## Non-Goals

- Do not become a full Stripe integration generator.
- Do not replace Stripe dashboard checks.
- Do not build arbitrary browser journey authoring yet.
- Do not build private repo GitHub App access before manual demand is proven.
- Do not add broad DAST crawling or active attack simulation.
- Do not compete on generic SEO audit depth.
- Do not make all warnings launch blockers.

## Open Decisions

1. Manual audit price: $49, $79, or $99.
2. Whether the first public page should be a new `/payments` page or a homepage pivot.
3. Whether to keep "90+ checks" visible as proof or demote it below the payment-readiness story.
4. Whether to sell one-time audits before enabling subscriptions.

## Sources

- Vibe App Scanner positioning and pricing: https://vibeappscanner.com/best-ai-security-scanner
- VibeEval 2026 AI-codegen scanner category survey: https://vibe-eval.com/updates/vibe-competitors-comparison/
- WebsiteReady public launch checker: https://websiteready.org/
- Preflight.sh CLI/docs: https://preflight.sh/documentation/
- Axios report on exposed AI-built apps: https://www.axios.com/2026/05/07/loveable-replit-vibe-coding-privacy
- Stripe subscription webhook guidance: https://docs.stripe.com/billing/subscriptions/build-subscription
- Stripe customer portal guidance: https://docs.stripe.com/customer-management
- GitHub Actions security guidance and dependency review action: https://docs.github.com/en/actions/security-guides/using-githubs-security-features-to-secure-your-use-of-github-actions
