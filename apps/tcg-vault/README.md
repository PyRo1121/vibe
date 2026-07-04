# TCG Vault

Multi-TCG collection tracker and programmatic SEO price pages — SvelteKit on Cloudflare Workers + D1 + R2.

Part of the **Vibe** monorepo (`apps/tcg-vault`). Preflight is a separate app in `apps/preflight`.

## Stack

- SvelteKit 2 / Svelte 5
- Cloudflare Workers (Static Assets), D1, R2, Cron
- Tailwind CSS v4

## Production

- **Site:** https://vault.latham.cloud
- **Fallback:** https://tcg-vault.latham.workers.dev
- **Sync API:** `POST /api/sync/scryfall?set=CODE` with `Authorization: Bearer $SYNC_SECRET`

Local secret is in `.dev.vars` (gitignored). Production secret is set via `wrangler secret put SYNC_SECRET`.

## Local setup

From the monorepo root:

```powershell
npm install
npm run dev:tcg-vault
```

Or from this directory:

```powershell
cd apps/tcg-vault
npm run dev
```

### 1. Create Cloudflare resources

```powershell
npx wrangler d1 create tcg-vault
```

Copy the `database_id` into `wrangler.jsonc`, then sync bindings in `src/cloudflare-env.d.ts` if needed.

```powershell
npx wrangler r2 bucket create tcg-vault-images
npm run cf-typegen
```

### 2. Apply migrations

```powershell
npx wrangler d1 migrations apply tcg-vault --local
npx wrangler d1 migrations apply tcg-vault --remote
```

### 3. Import MTG sets (Scryfall — free)

```powershell
# Local dev (SYNC_SECRET optional — open in dev only)
curl.exe -X POST "http://localhost:5173/api/sync/scryfall?set=mh3" -H "Content-Type: application/json"

# Production (SYNC_SECRET required)
curl.exe -X POST "https://vault.latham.cloud/api/sync/scryfall?set=mh3" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $env:SYNC_SECRET"
```

Then open:

- https://vault.latham.cloud/mtg
- https://vault.latham.cloud/mtg/mh3

## Scripts

| Command                      | Description                            |
| ---------------------------- | -------------------------------------- |
| `npm run dev`                | Vite dev server                        |
| `npm run build`              | Production build + cron worker wrapper |
| `npm run preview`            | Build + `wrangler dev` (port 8787)     |
| `npm run deploy`             | Build + deploy to Cloudflare           |
| `npm run verify`             | check + lint + unit tests + build      |
| `npm run sync:mtg:all`       | Import all MTG sets into remote D1     |
| `npm run sync:mtg:all:force` | Re-import every MTG set                |

From monorepo root: `npm run verify:tcg-vault`, `npm run deploy:tcg-vault`.

## Routes

| Path                               | Purpose                   |
| ---------------------------------- | ------------------------- |
| `/`                                | Game hub                  |
| `/{game}`                          | Sets for a game           |
| `/{game}/{set}`                    | Set checklist + prices    |
| `/{game}/{set}/{card}`             | Card price page (SEO)     |
| `POST /api/sync/scryfall?set=CODE` | Import/update one MTG set |

## Cron (nightly sync)

`wrangler.jsonc` defines `0 6 * * *`. `npm run build` wraps the SvelteKit worker with a `scheduled` handler that calls `runScheduledSync()` in `src/lib/server/scheduled.ts` (refreshes the 3 newest MTG sets).

## Data sources ($0 launch)

| Game      | Source        | Prices                      |
| --------- | ------------- | --------------------------- |
| MTG       | Scryfall      | Yes                         |
| Yu-Gi-Oh! | YGOProDeck    | Planned                     |
| Pokémon   | pokemontcg.io | Catalog only (prices later) |

## Docs

Monorepo overview: `docs/tcg-vault/overview.md`. Preflight docs live under `docs/superpowers/`.
