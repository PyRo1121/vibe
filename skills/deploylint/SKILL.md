---
name: deploylint
description: Run Deploylint launch-readiness scans and deploy gates before posting a URL publicly. Use before Product Hunt, Reddit, PR merges, or post-deploy verification.
---

# Deploylint agent skill

Deploylint answers: **should you post this URL today?** It returns GO/NO-GO, embarrassment risks, and fix prompts.

## When to use

- Night before Product Hunt, Reddit, or X launch
- After deploying a vibe-coded app (Cursor, Lovable, Bolt)
- In CI to block merges when P0 launch blockers exist
- After fixes — re-scan to prove score improved

## MCP tools (Cursor)

Add `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "deploylint": {
      "command": "npx",
      "args": ["tsx", "apps/preflight-mcp/src/index.ts"],
      "env": { "DEPLOYLINT_API": "https://deploylint.com" }
    }
  }
}
```

### `deploylint_scan`

- **url** — HTTPS site or `github.com/owner/repo`
- **format** — `markdown` (default) or `json` for agent parsing
- **max_issues** — default 25
- **unlock_session_id** — Stripe `cs_live_…` after $9 unlock → all fix prompts + master paste
- **previous_score** — with unlock, shows re-scan delta

Returns: score, verdict, embarrassment risks, prioritized issues, one free sample fix prompt (more after unlock).

### `deploylint_gate`

Same inputs plus:

- **min_score** — default 80
- **advisory** — `true` = report failures but never block

## CI deploy gate

**Composite action** (copy `.github/actions/deploylint-gate` from vibe repo):

```yaml
- uses: ./.github/actions/deploylint-gate
  with:
    url: ${{ secrets.DEPLOYLINT_GATE_URL }}
    min_score: "80"
    mode: gate
```

**Zero-install:**

```bash
curl -fsSL https://deploylint.com/gate-remote.mjs -o gate-remote.mjs
node gate-remote.mjs https://your-app.com
node gate-remote.mjs https://your-app.com --json
```

Env: `DEPLOYLINT_API`, `DEPLOYLINT_GATE_URL` (preferred), `PREFLIGHT_URL` (legacy alias),
`PREFLIGHT_MIN_SCORE`, `PREFLIGHT_MODE=advisory`.

## Fix loop

1. `deploylint_scan` — note P0 failures and embarrassment brief
2. Use fix prompts (unlock at deploylint.com for all prompts)
3. Deploy fixes
4. Re-scan with `unlock_session_id` + `previous_score` — confirm delta

## P0 blockers (gate fails)

Reachability, HTTPS, secrets, privacy, noindex, robots-block, form-security, exposed .env/.git, committed .env in repo scans.

## Do not confuse with

- **Lighthouse** — performance/a11y lab, not launch judgment
- **OG debuggers** — card preview only

Deploylint: **launch judgment + embarrassment prevention + fix-and-prove**.
