# Deploylint rebrand — test deployment spec

**Status:** Approved — Phase A test deploy  
**Date:** 2026-07-04  
**Production URL:** `https://lint.latham.cloud`  
**Future domain:** `deploylint.com` when registered

---

## Decision

| Field | Choice |
|-------|--------|
| **Product name** | **Deploylint** |
| **Test host** | `lint.latham.cloud` |
| **Internal package** | `apps/preflight` (unchanged) |
| **Cloudflare Worker** | `preflight` (unchanged — SELF/KV bindings) |
| **Tagline** | *Lint your launch before the internet does.* |
| **Hero** | *Should you post this URL today?* (unchanged) |

`launchlint.com` was unavailable. **Deploylint** keeps the lint metaphor with a deploy/CI gate angle.

---

## Phase A scope (this change)

- `wrangler.jsonc` → `lint.latham.cloud`, `PUBLIC_*` vars
- User-facing copy: Preflight → Deploylint
- `static/sitemap.xml`, `robots.txt`, `llms.txt`, `og.svg`
- Smoke/gate defaults → `DEPLOYLINT_BASE` / `lint.latham.cloud` (keep `PREFLIGHT_*` env aliases)
- Stripe webhook URL comments → `lint.latham.cloud`

**Not changed:** npm workspace name, MCP tool names, `preflight-session.ts`, Worker name, SELF binding.

---

## DNS / deploy checklist

1. Add `lint.latham.cloud` custom domain in Cloudflare (same zone as `latham.cloud`)
2. `npm run deploy:preflight`
3. `npm run smoke:preflight` with default base
4. Update Stripe webhook URL if using checkout on test host

---

## Future (when ready)

- Register `deploylint.com`
- 301 `lint.latham.cloud` → production domain
- Optional monorepo rename `apps/preflight` → `apps/deploylint`
