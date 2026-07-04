# Preflight Phase 19 — CI deploy gate wedge

**Goal:** Extend fix-and-prove from browser → deploy pipeline. Block merges when launch blockers remain.

## Wedge

Scan in browser → fix with Cursor prompts → re-scan for delta → **gate CI before ship**.

This is not Lighthouse CI. It is the same GO/NO-GO judgment builders already trust, wired into GitHub Actions and local CLI.

## Scope

| In | Out |
|----|-----|
| `/developers` docs page | Live Stripe (Phase 20) |
| Hosted `gate-remote.mjs` (zero install) | Multi-page crawl |
| Homepage + footer links to docs | Accounts / subscriptions |
| `smoke:phase19` production checks | Deeper bundle crawl (backlog) |
| llms.txt CI mention | |

## Gate rules (unchanged)

- Fail on `no-go` verdict
- Fail when score < `PREFLIGHT_MIN_SCORE` (default 80)
- Fail on any P0 check failure (secrets, privacy, https, noindex, robots-block, etc.)

## Exit criteria

- `npm run verify:preflight` green
- `npm run smoke:phase19` 12/12 on production after deploy
- `/developers` documents local CLI, hosted script, GitHub Action, MCP tools

## Ship loop roles

- **CTO:** this spec + plan
- **Engineer:** gate-remote, developers page, smoke
- **QC:** spec compliance, no scope creep
- **Testing:** verify + smoke
