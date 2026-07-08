---
name: deploylint
description: Run Deploylint CI/deploy readiness reviews and deploy gates before production risk reaches users. Use before PR merges, release gates, repo handoffs, or post-deploy verification.
---

# Deploylint agent skill

Deploylint answers: **is this project ready for a deploy gate?** It returns a
readiness score, P0 gate blockers, deploy evidence to fix, and guided repair
plans.

## When to use

- Before merging PRs that change deploy, auth, billing, secrets, or public surfaces
- After deploying a vibe-coded app (Cursor, Lovable, Bolt) and before routing traffic
- In CI to block merges when P0 deploy-gate blockers exist
- After fixes - re-scan to prove score improved

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

- **url** - HTTPS site or `github.com/owner/repo`
- **format** - `markdown` (default) or `json` for agent parsing
- **max_issues** - default 25
- **unlock_session_id** - Stripe `cs_live_...` after unlock, enabling all guided fixes and repair-plan output
- **previous_score** - with unlock, shows re-scan delta

Returns: score, verdict, deploy evidence to fix, prioritized issues, one free
sample guided fix (more after unlock).

### `deploylint_gate`

Same inputs plus:

- **min_score** - default 80
- **advisory** - `true` = report failures but never block

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

1. `deploylint_scan` - note P0 failures and deploy evidence to fix
2. Use guided fixes (unlock at deploylint.com for the full repair plan)
3. Deploy fixes
4. Re-scan with `unlock_session_id` + `previous_score` - confirm delta

## P0 Blockers

Reachability, HTTPS, secrets, privacy, noindex, robots-block, form-security,
exposed .env/.git, committed .env in repo scans.

## Do not confuse with

- **Lighthouse** - performance/a11y lab, not deploy readiness
- **OG debuggers** - card preview only

Deploylint: **deploy readiness evidence + gate blockers + fix-and-prove**.
