# Tech stack policy — bleeding edge

We ship on the **latest stable** releases of the stack, refreshed weekly via Dependabot. Pre-release channels are allowed when they are clearly ahead and verify green.

## Current pins (monorepo `overrides`)

| Layer | Package | Channel |
|-------|---------|---------|
| UI | Svelte 5 | `latest` |
| Framework | SvelteKit 2 | `latest` (SK 3 `next` tracked, not adopted until stable) |
| Bundler | Vite 8 | `latest` |
| Language | TypeScript 6 | `latest` |
| CSS | Tailwind 4 | `latest` |
| Runtime | Cloudflare Workers + Wrangler 4 | `latest` |
| Types | `@cloudflare/workers-types` 5 | `latest` |
| Tasks | Turbo 2 | `latest` |
| Tests | Vitest 4 | `latest` (Vitest 5 `beta` when green) |

## Upgrade workflow

```powershell
npm run upgrade:stack    # bump workspace deps
npm run verify           # all apps must pass
```

CI gates: `preflight-gate.yml`, `tcg-vault-gate.yml` on every PR. Both apps run `check + lint + test + build` via `verify`.

## Pre-release adoption criteria

1. `npm run verify` passes for **both** apps
2. No known blocker in Svelte/Cloudflare issue trackers
3. Document the bump in the PR body

## Optional next channels (watch list)

- `@sveltejs/kit@3.0.0-next` + `@sveltejs/adapter-cloudflare@8.0.0-next`
- `vitest@5.0.0-beta`
- `typescript@7.0.0-rc`

## Node

- **CI / local:** Node 22+ (`.nvmrc`)
- **Types:** `@types/node@26` for current platform APIs
