# Vibe

Turborepo monorepo for **Deploylint** (launch-readiness audits; internal workspace
`preflight`), **Deploylint MCP**, and **TCG Vault** (multi-TCG price catalog).

## Apps

| App                      | Path                 | Command                        |
| ------------------------ | -------------------- | ------------------------------ |
| Deploylint (`preflight`) | `apps/preflight`     | `npm run dev:preflight`        |
| TCG Vault                | `apps/tcg-vault`     | `npm run dev:tcg-vault`        |
| Deploylint MCP           | `apps/preflight-mcp` | `npm run dev -w preflight-mcp` |

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
- Deploylint workflow: `docs/superpowers/workflow/preflight-loop-status.md`

## Requirements

- Node 22+ (see `.nvmrc`)

## Git remote (first push)

```powershell
git remote add origin https://github.com/YOUR_ORG/vibe.git
git push -u origin main
```

Run `gh auth login` first if using GitHub CLI to create the repo.
