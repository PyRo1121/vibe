# TCG Vault

Multi-TCG price catalog and programmatic SEO pages — separate product from [Preflight](../superpowers/workflow/ship-loop.md).

- **App path:** `apps/tcg-vault`
- **Production:** https://vault.latham.cloud
- **Setup & sync:** see `apps/tcg-vault/README.md`

## Monorepo commands

```powershell
npm run dev:tcg-vault
npm run verify:tcg-vault:ci
npm run deploy:tcg-vault
```

## Status (2026-07)

| Feature                 | Status                              |
| ----------------------- | ----------------------------------- |
| MTG prices via Scryfall | Live                                |
| Other TCG games         | UI only — sync not built            |
| Collection / Pro tier   | Planned (schema exists)             |
| Nightly cron sync       | Wired via post-build worker wrapper |
