# Preflight Phase 3 — Embarrassment-prevention wedge

**Goal:** Differentiate on launch decision + fix-and-verify loop, not check count.

## Primary wedge

Run before posting URL publicly → **GO / CONDITIONAL / NO-GO** verdict with P0/P1/P2 priorities.

## Phases

| Phase | Scope | Exit |
|-------|--------|------|
| 13 | Verdict + priority on every check | Tests green |
| 14 | Re-scan delta included in $9 unlock | E2E unlock → re-scan shows delta |
| 15 | Master fix prompt + one free sample prompt | QC pass |
| 16 | Social preview panel (OG mock cards) | UI + tests |
| 17 | Share score copy button | Manual smoke |

## Free vs paid (Phase 3)

| Free | Paid ($9) |
|------|-----------|
| Full score + verdict + all issues | All fix prompts |
| Social preview diagnosis | Master repair prompt |
| Top 3 issues | Unlimited re-scans (same URL, same session) |
| **One sample fix prompt** (highest-priority fail) | Score delta on re-scan |

## Non-goals (Phase 3)

- JS bundle secret fetch (P2 — later)
- MCP / GitHub Action (P2 — later)
- Subscription tier
- Accounts / monitoring

## Kill metrics (45-day)

- 0 unlocks after 30 days → pivot offer (re-scan messaging)
- Unlocks but no re-scan → improve prompt evidence
- Unlocks + re-scans → keep, build CI wedge
