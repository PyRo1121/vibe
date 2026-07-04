# Preflight ship loop — status

## Overall progress: Phase 22 deeper JS crawl

| Milestone | Status |
|-----------|--------|
| MVP (scan + deploy) | ✅ |
| Phase 13–17 (verdict, re-scan, prompts, social, share) | ✅ |
| Phase 18 (validation funnel + conversion UX) | ✅ shipped — watch metrics in parallel |
| Phase 19 (CI gate product wedge) | ✅ |
| Phase 20 (multi-page legal crawl + pagesScanned) | ✅ |
| Phase 21 (same-zone self-scan via SELF binding) | ✅ |
| Phase 22 (deeper JS + source-map secret crawl) | ✅ |
| World-class baseline (lint, a11y dogfood, SSRF, rate limit, UI) | ✅ |
| Blocked-scan guard (403/4xx/5xx → skip content checks) | ✅ |
| P2 (JS secrets, CI gate CLI, MCP) | ✅ |
| World-class scan depth | ✅ |

**Primary URL:** https://preflight.latham.cloud

## Verification

- **125+ tests** — `npm run verify:preflight`
- Phase 18 smoke — `npm run smoke:phase18 -w preflight` (14 checks)
- Phase 19 smoke — `npm run smoke:phase19 -w preflight` (7 checks)
- Phase 20 smoke — `npm run smoke:phase20 -w preflight` (multi-page crawl via external URL; self-scan skipped — CF 522)
- Full smoke — `npm run smoke:preflight` (phases 18–20)
- Gate CLI — `npm run gate:preflight -- https://your-app.com`

## Roadmap (what to do next)

### Phase 18 — Validation (parallel)

Per Phase 3 kill metrics (45 days). **Ops runs in parallel** — engineering continues on Phase 21+.

| Signal (30–45 days) | Action |
|---------------------|--------|
| Scans but **0 unlocks** | Pivot copy toward re-scan proof / stronger sample prompt |
| Unlocks but **no re-scans** | Improve prompt evidence + post-unlock guide |
| Unlocks **+ re-scans** | Keep wedge; wire CI gate on your own repos |

**Ops checklist:**

1. Register Plausible for `preflight.latham.cloud`
2. One test checkout (`4242…`) → unlock → re-scan delta
3. Add `PREFLIGHT_GATE_URL` secret → run GitHub Action from `/developers`
4. Watch funnel events 30–45 days

### Phase 19 — CI deploy gate (now)

| Item | Status |
|------|--------|
| `/developers` docs page | ✅ |
| Hosted `/gate-remote.mjs` | ✅ |
| Homepage + nav links | ✅ |
| `smoke:phase19` | ✅ |

### Phase 20 — Multi-page scan (shipped)

| Item | Status |
|------|--------|
| Crawl privacy / terms / pricing from homepage links | ✅ |
| Legal checks verify content (not link-only) | ✅ |
| Cross-page placeholder + secrets sweep | ✅ |
| `PagesScannedStrip` UI | ✅ |
| `smoke:phase20` dogfood | ✅ (plausible.io; self-scan skipped — CF same-zone) |

### Phase 21 — Same-zone self-scan (shipped)

| Item | Status |
|------|--------|
| SELF service binding in wrangler | ✅ |
| `createScanDeps` routes same-host fetches via binding | ✅ |
| Self-scan dogfood in `smoke:phase20` | ✅ after deploy |

### Phase 22 — Deeper JS crawl (shipped)

| Item | Status |
|------|--------|
| `MAX_SCRIPT_FETCHES` 5 → 10 | ✅ |
| Source-map secret sweep (`sourcesContent`) | ✅ |
| Script scan across crawled sub-pages | ✅ |

### Phase 23 — Sitemap-driven crawl (shipped)

| Item | Status |
|------|--------|
| Parse sitemap.xml (urlset + index) | ✅ |
| Supplemental crawl up to 2 marketing pages | ✅ |
| Cross-page placeholder + secrets on sitemap pages | ✅ |
| `PagesScannedStrip` path labels for sitemap role | ✅ |

### Phase 24+ — Parallel with validation

| Item | Notes |
|------|-------|
| Live Stripe keys + live webhook | Code ready — flip keys when charging |
| Subscription / accounts | Still non-goal until wedge proven |

## Product wedge (do not compete with Lighthouse)

Sell **launch judgment + embarrassment prevention + fix-and-prove**, not perf scores.

- Free: GO/NO-GO, embarrassment radar, social preview, 1 sample prompt
- Paid ($9): all Cursor prompts, master paste, unlimited re-scans + delta

## Dev commands

```powershell
cd apps/preflight
npm run verify:preflight
npm run deploy:preflight          # from repo root: npm run deploy:preflight
npm run gate:preflight -- https://your-app.com
npm run stripe -- login
npm run setup:stripe
```

## MCP

`.cursor/mcp.json` — tools: `preflight_scan`, `preflight_gate`
