# Deploylint

Lint your launch before the internet does — GO/NO-GO verdict, embarrassment radar, and fix prompts with re-scan proof.

**Test deployment:** [deploylint.com](https://deploylint.com)
(Internal package name remains `preflight` in the monorepo.)

## Product

- **Free:** verdict, embarrassment brief, social preview, one sample fix prompt
- **Paid subscriptions:** Solo $9/mo, Builder $29/mo, Agency $149/mo for prompts, MCP access, monitoring, and re-scan proof
- **CI gate** — zero-install script (`/gate-remote.mjs`). See [/developers](https://deploylint.com/developers).

## Dev

```bash
npm run dev -w preflight
npm run verify:preflight
npm run deploy:preflight
npm run smoke:preflight
```

## Verification

- `npm.cmd run verify -w preflight` checks type safety, lint, unit coverage, and production build.
- `npm.cmd run verify -w preflight-mcp` checks the MCP package.
- `npm.cmd run test:e2e -w preflight` checks browser-level user flows.
- `npm.cmd run smoke:preflight` checks production-facing scan, billing, crawler, and gate surfaces.
- `npm.cmd run verify:deploylint` runs the full Deploylint confidence gate.
