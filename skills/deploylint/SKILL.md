---
name: deploylint
description: Run Deploylint launch-readiness scans and deploy gates before posting a URL publicly. Use before Product Hunt, Reddit, PR merges, or post-deploy verification.
---

# Deploylint agent skill

Deploylint answers: **should you post this URL today?** It returns GO/NO-GO, embarrassment risks, and Cursor fix prompts.

## When to use

- Night before Product Hunt, Reddit, or X launch
- After deploying a vibe-coded app (Cursor, Lovable, Bolt)
- In CI to block merges when P0 launch blockers exist
- After fixes — re-scan to prove score improved

## Scan a live URL

**MCP tools** (preferred in Cursor):

- `deploylint_scan` — full report with score and issues
- `deploylint_gate` — PASS/FAIL (P0 blockers + min score 80)

Default API: `https://lint.latham.cloud`  
Override: `DEPLOYLINT_API` env var.

## CI deploy gate (no install)

```bash
curl -fsSL https://lint.latham.cloud/gate-remote.mjs -o gate-remote.mjs
node gate-remote.mjs https://your-app.com
# JSON output for Actions:
node gate-remote.mjs --json https://your-app.com
```

Env: `DEPLOYLINT_API`, `PREFLIGHT_URL`, `PREFLIGHT_MIN_SCORE` (default 80).

## Fix loop

1. Run scan — note P0/P1 failures and embarrassment brief
2. Paste per-check `fixPrompt` or unlock **Deploylint fix & verify** ($9) for master prompt
3. Deploy fixes
4. Re-scan same URL — confirm score delta and cleared blockers

## P0 blockers (gate fails)

Reachability, HTTPS, secrets, privacy, noindex, robots-block, form-security, exposed .env/.git, committed .env in repo scans.

## Do not confuse with

- **Lighthouse** — performance/a11y lab, not launch judgment
- **OG debuggers** — card preview only

Deploylint: **launch judgment + embarrassment prevention + fix-and-prove**.
