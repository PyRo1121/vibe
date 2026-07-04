# Preflight ship loop — status

## Overall progress: Phase 19 + blocked-scan guard

| Milestone | Status |
|-----------|--------|
| MVP (scan + deploy) | ✅ |
| Phase 13–17 (verdict, re-scan, prompts, social, share) | ✅ |
| Phase 18 (validation funnel + conversion UX) | ✅ shipped — watch metrics |
| Phase 19 (CI gate product wedge) | ✅ |
| Blocked-scan guard (403/4xx/5xx → skip content checks) | ✅ |
| P2 (JS secrets, CI gate CLI, MCP) | ✅ |
| World-class scan depth | ✅ |

**Primary URL:** https://preflight.latham.cloud

## Verification

- **125+ tests** — `npm run verify:preflight`
- Phase 18 smoke — `npm run smoke:phase18 -w preflight` (14 checks)
- Phase 19 smoke — `npm run smoke:phase19 -w preflight` (7 checks)
- Full smoke — `npm run smoke:preflight` (both)
- Gate CLI — `npm run gate:preflight -- https://your-app.com`

## Roadmap (what to do next)

### Phase 18 — Validation (parallel)

Per Phase 3 kill metrics (45 days). **No new scan checks** until data:

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

### Phase 20+ — Only if validation passes

| Item | When |
|------|------|
| Live Stripe keys + live webhook | Ready for real charges |
| Deeper JS bundle crawl | P2 backlog |
| Subscription / accounts | Explicit non-goal until wedge proven |

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
