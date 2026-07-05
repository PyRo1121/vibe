# Preflight ship loop — status

## Overall progress: Phase 32–34 founder conversion (A shipped)

| Milestone                                                         | Status |
| ----------------------------------------------------------------- | ------ |
| Phase 26–28 (check depth: exposed paths, health, manifest, debug) | ✅     |
| Phase 29–31 (MCP deploylint_*, agent skill, gate P0 sync, --json) | ✅     |
| Phase 32–34 (founder conversion UX)                               | ✅     |
| World-class baseline (lint, a11y dogfood, SSRF, rate limit, UI)   | ✅     |
| Blocked-scan guard (403/4xx/5xx → skip content checks)            | ✅     |
| P2 (JS secrets, CI gate CLI, MCP)                                 | ✅     |
| World-class scan depth                                            | ✅     |

**Primary URL:** https://deploylint.com (Deploylint production domain; `lint.latham.cloud` remains as a legacy redirect)

## Verification

- **510 tests** — `npm run verify:preflight`
- Phase 18 smoke — `npm run smoke:phase18 -w preflight` (19 checks)
- Phase 19 smoke — `npm run smoke:phase19 -w preflight` (7 checks)
- Phase 20 smoke — `npm run smoke:phase20 -w preflight` (multi-page crawl)
- Phase 23 smoke — `npm run smoke:phase23 -w preflight` (sitemap dogfood + self-scan)
- Phase 24 smoke — `npm run smoke:phase24 -w preflight` (Stripe checkout + webhook probe)
- Full smoke — `npm run smoke:preflight` (phases 18–24)
- Gate CLI — `npm run gate:preflight -- https://your-app.com`

## Roadmap (what to do next)

### Phase 18 — Validation (parallel)

Per Phase 3 kill metrics (45 days). **Ops runs in parallel** — engineering continues on Phase 21+.

| Signal (30–45 days)         | Action                                                   |
| --------------------------- | -------------------------------------------------------- |
| Scans but **0 unlocks**     | Pivot copy toward re-scan proof / stronger sample prompt |
| Unlocks but **no re-scans** | Improve prompt evidence + post-unlock guide              |
| Unlocks **+ re-scans**      | Keep wedge; wire CI gate on your own repos               |

**Ops checklist:**

1. ~~Register Plausible for `deploylint.com`~~ ✅ — add custom goals in Plausible dashboard (see below)
2. One live checkout ($9) → unlock → re-scan delta (blocked until Stripe enables charges)
3. ~~Add `DEPLOYLINT_GATE_URL` secret~~ → set `DEPLOYLINT_GATE_URL` (or legacy `PREFLIGHT_GATE_URL`) to `https://deploylint.com` on vibe repo; workflow uses `deploylint.com` API
4. Watch funnel events 30–45 days

### Phase 19 — CI deploy gate (now)

| Item                      | Status |
| ------------------------- | ------ |
| `/developers` docs page   | ✅     |
| Hosted `/gate-remote.mjs` | ✅     |
| Homepage + nav links      | ✅     |
| `smoke:phase19`           | ✅     |

### Phase 20 — Multi-page scan (shipped)

| Item                                                | Status                                              |
| --------------------------------------------------- | --------------------------------------------------- |
| Crawl privacy / terms / pricing from homepage links | ✅                                                  |
| Legal checks verify content (not link-only)         | ✅                                                  |
| Cross-page placeholder + secrets sweep              | ✅                                                  |
| `PagesScannedStrip` UI                              | ✅                                                  |
| `smoke:phase20` dogfood                             | ✅ (plausible.io; self-scan skipped — CF same-zone) |

### Phase 21 — Same-zone self-scan (shipped)

| Item                                                  | Status          |
| ----------------------------------------------------- | --------------- |
| SELF service binding in wrangler                      | ✅              |
| `createScanDeps` routes same-host fetches via binding | ✅              |
| Self-scan dogfood in `smoke:phase20`                  | ✅ after deploy |

### Phase 22 — Deeper JS crawl (shipped)

| Item                                       | Status |
| ------------------------------------------ | ------ |
| `MAX_SCRIPT_FETCHES` 5 → 10                | ✅     |
| Source-map secret sweep (`sourcesContent`) | ✅     |
| Script scan across crawled sub-pages       | ✅     |

### Phase 23 — Sitemap-driven crawl (shipped)

| Item                                              | Status                          |
| ------------------------------------------------- | ------------------------------- |
| Parse sitemap.xml (urlset + index)                | ✅                              |
| Supplemental crawl up to 2 marketing pages        | ✅                              |
| Cross-page placeholder + secrets on sitemap pages | ✅                              |
| `PagesScannedStrip` path labels for sitemap role  | ✅                              |
| `static/sitemap.xml` marketing URLs               | ✅                              |
| `smoke:phase23` dogfood                           | ✅ (self-scan via SELF binding) |

### Phase 24 — Deeper crawl + Stripe live readiness (shipped)

| Item                                               | Status |
| -------------------------------------------------- | ------ |
| `Sitemap:` discovery from robots.txt               | ✅     |
| Merge locs from multiple sitemaps (deduped)        | ✅     |
| Pricing page from sitemap when not homepage-linked | ✅     |
| `isStripeLiveMode` + `setup-stripe-live.ps1`       | ✅     |
| `smoke:phase24` checkout + webhook probe           | ✅     |

**Stripe live checklist** (no secrets in repo):

1. `npm run stripe -- login` (Stripe CLI)
2. `powershell -ExecutionPolicy Bypass -File scripts/setup-stripe-live.ps1` — creates live webhook at `https://deploylint.com/api/webhooks/stripe` (real charges)
3. `npx wrangler secret put STRIPE_SECRET_KEY` — paste `sk_live_…` from [live API keys](https://dashboard.stripe.com/apikeys)
4. `npx wrangler secret put STRIPE_WEBHOOK_SECRET` — paste `whsec_…` from script output
5. `npm run deploy` then `npm run smoke:phase24` — checkout skips with message if not configured; webhook GET must return `ok`
6. Test mode remains `scripts/setup-stripe.ps1` + test keys (`sk_test_…`)

### Phase 25 — KV unlock persistence (shipped)

| Item                                                       | Status |
| ---------------------------------------------------------- | ------ |
| Webhook writes `unlock:{url}` to KV on paid checkout       | ✅     |
| Re-scans verify via KV cache (skip Stripe API when cached) | ✅     |
| Write-through cache on first Stripe verify                 | ✅     |
| `/compare` + `/developers` preferred sitemap paths         | ✅     |

### Phase 32–34 — Founder conversion (Phase A, shipped)

| Item                                                                             | Status                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Score delta badge + fixed blocker diff (`ScoreDeltaBadge`, `computeFixProgress`) | ✅                                                                  |
| Baseline checks in sessionStorage on first scan                                  | ✅                                                                  |
| `PostUnlockGuide` progress ring after re-scan                                    | ✅                                                                  |
| `/compare` — ShipReady, WebsiteReady, PageLens columns                           | ✅                                                                  |
| Unlock panels — master prompt line count + Fix All headline                      | ✅                                                                  |
| Plausible on `deploylint.com`                                                 | ✅ first-party proxy `/s/script.js` + funnel via `window.plausible` |
| Funnel: `rescan_completed` with `scoreDelta`                                     | ✅ (existing `trackFunnel`)                                         |

**Plausible custom goals** (Settings → Goals → Add goal → Custom event):

| Event name         | When fired                        |
| ------------------ | --------------------------------- |
| `scan_completed`   | Free scan finishes                |
| `unlock_click`     | User clicks $9 unlock             |
| `checkout_started` | Redirect to Stripe                |
| `checkout_paid`    | Webhook fulfillment (server)      |
| `rescan_completed` | Unlocked re-scan with score delta |

Props (`verdict`, `score`, `scoreDelta`, etc.) appear on Business/trial plans.

**Stripe live status** (DeployLint acct `acct_1TpcWPPI6tkdUQSc`, Jul 5 2026):

| Check                                                  | Status                                                                                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`   | ✅                                                                                                                                                                   |
| Live webhook → `deploylint.com/api/webhooks/stripe` | ✅ `we_1TpctGPI6tkdUQScHy1GREWi`                                                                                                                                     |
| Checkout session creation (`cs_live_…`)                | ✅ `smoke:preflight` / `smoke:phase24`                                                                                                                               |
| `charges_enabled` / `card_payments`                    | ⏳ **pending** — Stripe reviewing `business_profile.url`; product description now matches DeployLint                                                                 |
| GitHub `DEPLOYLINT_GATE_URL` on vibe repo              | ✅ `https://deploylint.com`                                                                                                                                       |
| Test webhook cleanup                                   | ✅ deleted `we_1TpcxEPI6tkdUQSc7Zupn4ZH`                                                                                                                             |
| Prior blocker                                          | `invalid_url_website_inaccessible` — resolved once `https://deploylint.com` is set in [Business settings](https://dashboard.stripe.com/settings/business-details) |

When `charges_enabled` flips true: run one $9 checkout → confirm webhook → re-scan for delta proof.

**Optional cleanup:** ~~Delete test-mode webhook `we_1TpcxEPI6tkdUQSc7Zupn4ZH`~~ ✅ done

**Manual unlock→re-scan path:** Scan URL → checkout $9 → return with `?checkout=success` → copy master prompt → fix → **Re-scan to verify** → delta badge + progress ring.

### Phase 28b — DKIM probe (shipped)

| Item                                                              | Status |
| ----------------------------------------------------------------- | ------ |
| `dkim-dns` check — common `_domainkey` selectors when SPF present | ✅     |
| `/compare` row for SPF/DMARC/DKIM                                 | ✅     |

### Phase 35 — Backlog (shipped)

| Item                                                                                                                       | Status        |
| -------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `/changelog` public page                                                                                                   | ✅            |
| `lint.latham.cloud` + `www.deploylint.com` 301 redirect hook to `deploylint.com`                                           | ✅ code ready |
| Plausible first-party proxy                                                                                                | ✅            |
| **v0.35.0** — tag `deploylint-v0.35.0`, [GitHub release](https://github.com/PyRo1121/vibe/releases/tag/deploylint-v0.35.0) | ✅            |

### Phase 36 — World-class polish (shipped)

| Item                                                       | Status |
| ---------------------------------------------------------- | ------ |
| **91 unique checks** (`npm run count:checks -w preflight`) | ✅     |
| `security.txt` probe (RFC 9116)                            | ✅     |
| `/db.sql` exposed in backup probe                          | ✅     |
| `charset-meta` UTF-8 check                                 | ✅     |
| Share text uses embarrassment hook + permalink             | ✅     |
| Report `/r/[id]` OG/Twitter badge image                    | ✅     |
| Score delta on shared reports                              | ✅     |
| `/developers` README badge embed docs                      | ✅     |
| `/compare` security.txt + badge rows                       | ✅     |
| Edge security + zone WAF (prior session)                   | ✅     |

### Phase 37 — Dogfood + header depth (shipped)

| Item                                                  | Status |
| ----------------------------------------------------- | ------ |
| **92 unique checks** — `permissions-policy-header`    | ✅     |
| Dogfood `/.well-known/security.txt` + `/security.txt` | ✅     |
| Smoke phase18 asserts security.txt                    | ✅     |

### Phase 26+ — Parallel with validation

| Item                                            | Notes                             |
| ----------------------------------------------- | --------------------------------- |
| Live Stripe keys on Worker (flip when charging) | Run checklist below               |
| Subscription / accounts                         | Still non-goal until wedge proven |

## Product wedge (do not compete with Lighthouse)

Sell **launch judgment + embarrassment prevention + fix-and-prove**, not perf scores.

- Free: GO/NO-GO, embarrassment radar, social preview, 1 sample prompt
- Paid ($9): all Cursor prompts, master paste, unlimited re-scans + delta

## Dev commands

```powershell
cd C:\Users\olen\Documents\Coding\Vibe
npm run verify:preflight
npm run deploy:preflight
npm run gate:preflight -- https://your-app.com
npm run smoke:preflight           # phases 18–24
npm run changelog:draft -w preflight   # draft bullets from conventional commits
npm run setup:plausible-goals -w preflight   # needs PLAUSIBLE_PLUGIN_TOKEN
npm run setup:cloudflare-firewall -w preflight   # needs CLOUDFLARE_API_TOKEN (Zone WAF Edit)
# Cloudflare Free tier guardrails: docs/superpowers/workflow/cloudflare-free-tier.md
# Release: docs/superpowers/workflow/changelog-and-releases.md
npm run setup:stripe              # test mode
# Live: scripts/setup-stripe-live.ps1
```

## MCP

`.cursor/mcp.json` — server `deploylint`: tools `deploylint_scan`, `deploylint_gate` (`format: json`, `advisory`, `unlock_session_id`)

Composite action: `.github/actions/deploylint-gate` · dogfood workflow: `deploylint-dogfood.yml`
