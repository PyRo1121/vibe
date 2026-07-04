# Vibe

Turborepo monorepo for **Preflight** (site readiness audits) and **TCG Vault** (multi-TCG price catalog).

## Apps

| App | Path | Command |
|-----|------|---------|
| Preflight | `apps/preflight` | `npm run dev:preflight` |
| TCG Vault | `apps/tcg-vault` | `npm run dev:tcg-vault` |
| Preflight MCP | `apps/preflight-mcp` | — |

## Commands

```powershell
npm install
npm run verify          # all apps
npm run verify:preflight
npm run verify:tcg-vault
npm run upgrade:stack   # bump deps to latest
```

## Docs

- Monorepo stack policy: `docs/tech-stack.md`
- TCG Vault: `docs/tcg-vault/overview.md`
- Preflight workflow: `docs/superpowers/workflow/ship-loop.md`

## Requirements

- Node 22+ (see `.nvmrc`)
