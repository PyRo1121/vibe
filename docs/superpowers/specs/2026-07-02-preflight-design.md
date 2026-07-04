# Preflight — Product Design Spec

**Date:** 2026-07-02  
**Status:** Approved for implementation  
**Codename:** Preflight (professional brand; replaces VibeGuard spike)

## Problem

Vibecoders ship fast. After launch (or a near-miss), someone points out a missing privacy policy, broken OG preview, exposed key pattern, or dead link. The builder feels embarrassed and wants a trustworthy audit plus fast fixes.

## Solution

**Preflight** — a professional site readiness audit. Enter a URL, get a launch score and categorized checklist. Pay once to unlock copy-paste AI fix prompts for each issue.

## Audience

Any vibecoder (broad). Copy is professional, not meme-y.

## Trigger moment

Reactive embarrassment — user arrives after something was already called out (or they fear it will be).

## User flow

1. Land on homepage → enter URL
2. Free scan → score 0–100 + pass/warn/fail checklist by category
3. See what's wrong (free) → pay to unlock fix prompts (paid)
4. Copy prompt → paste into Cursor/Claude → ship fix

## Free vs paid

| Free | Paid ($9 one-time MVP) |
|------|------------------------|
| Launch score | Full fix prompt per failed/warn check |
| All check results (pass/warn/fail) | Copy button per prompt |
| Top issues highlighted | Prompt includes URL + check context |
| Category breakdown | |

Fix prompts are **blurred/locked** on free tier.

## Check categories (balanced scoring)

- **Security:** HTTPS, secret patterns in HTML, mixed-content hints
- **Legal:** privacy policy link, terms link (footer/common paths)
- **SEO / social:** title, meta description, OG tags, favicon
- **Mobile:** viewport meta
- **Accessibility:** lang attribute, H1, sample image alts
- **Launch:** reachability, HTTP status, robots.txt presence
- **Links:** sample internal link HEAD checks (bounded)

~12–15 checks total. Equal weight in score unless critical fail (e.g. unreachable → cap score).

## Non-goals (MVP)

- User accounts, scan history dashboard
- Multi-page crawl, authenticated flows
- Stripe live checkout (stub CTA only for v1)
- Monitoring / re-scan alerts
- PDF export, certification badge

## Architecture

- **SvelteKit 5** on **Cloudflare Workers**
- Scan logic in `$lib/scan/*` — pure functions + injectable `fetch` for tests
- **SSRF guard:** HTTPS only, block private/loopback/metadata hosts, manual redirects (max 5), 2MB response cap
- **API:** `POST /api/scan` JSON `{ url }` → `ScanReport`
- **UI:** single page — form, loading, error, results, paywall blur on prompts

## Security requirements

- Validate URL before fetch; re-validate on redirect
- Reject non-HTTPS, credentials in URL, private IP literals
- Limit request body size (4KB)
- No secrets in client bundle

## Success metrics (30–45 days)

- Daily scans (organic + shares)
- Free → paid prompt unlock conversion
- Qualitative: catches real issues before public launch

## Portfolio fit

- Landing: professional audit positioning
- Free tool: scan
- Paid: fix prompts
- One audience: vibecoders
- Kill if scans but zero conversion after experiment window

## Brand

- **Name:** Preflight
- **Headline:** Find what's broken before someone else does.
- **Tone:** Trustworthy, calm, specific — not "roast my app"
