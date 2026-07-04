# Preflight

**Should you post this URL today?** Launch-readiness audits for vibe-coded apps — a GO / CONDITIONAL / NO-GO verdict, not a Lighthouse score.

Live at [preflight.latham.cloud](https://preflight.latham.cloud).

## What it does

- **Site scans** — 60+ checks across SEO, legal, security, accessibility, mobile, AI readiness, conversion, and launch signals: placeholder copy, og:image content-type, secrets in JS bundles, SPF/DMARC, soft 404s, cookie consent, AI crawler access, form labels, static performance heuristics, trust/freshness signals, and more.
- **Repo scans** — paste a GitHub URL: committed .env files, secret patterns in source, README quality, CI/tests/lockfile hygiene, repo + dependency licenses, transitive license screen of the lockfile, and known vulnerabilities via OSV.dev.
- **License & sell rights** — "can you charge money for this?" across CDN scripts, bundles, and npm dependencies.
- **Fix & prove loop** — $9 unlocks copy-paste Cursor fix prompts, a master repair prompt, AI copy review, and re-scan score deltas with check-level fixed/regressed diffs.
- **Sharing** — 90-day report permalinks (`/r/[id]`), stakeholder brief view (`?view=brief`), README score badges (`/r/[id]/badge.svg`), print/PDF export.
- **CI gate** — zero-install script (`/gate-remote.mjs`) that fails builds on launch blockers, posts PR comments, and supports advisory mode. See [/developers](https://preflight.latham.cloud/developers).

## Stack

SvelteKit (Svelte 5) on Cloudflare Workers. KV for report storage and scan history, Workers AI for paid copy review, Stripe for checkout. Designed to stay inside the Cloudflare free tier.

## Architecture

```
src/lib/scan/          Site scan engine
  engine.ts            Orchestrator — fetch, fan out probes, build checks
  fetchers.ts          Network layer (injectable via ScanDeps)
  probes.ts            Link health, sitemap, scripts, DNS, host probes
  analyze.ts           Check orchestration
  checks/              Check builders by group (meta, a11y, seo-depth, ai-readiness, …)
  license.ts           License audit logic (+ license-db.ts curated facts)
  repo/                GitHub repo scans (lockfile, OSV, secrets, licenses, CI hygiene)
e2e/                   Playwright end-to-end tests (mocked scan API)
src/lib/server/        Scan handler, report store (KV), badges, AI copy review
src/lib/billing/       Stripe checkout + report sanitization (free vs paid)
src/lib/components/    Report UI
scripts/gate-remote.mjs  CI deploy gate (also served at /gate-remote.mjs)
```

## Dev

```powershell
npm install
npm run dev        # local dev server
npm run verify     # check + tests + build
npm run test:e2e   # Playwright browser tests (mocked scan API)
```

## Deploy

```powershell
npm run deploy     # build + wrangler deploy
```

## CI gate

```powershell
node scripts/gate-remote.mjs https://your-app.com
# PREFLIGHT_MIN_SCORE=80  PREFLIGHT_MODE=advisory  — see /developers
```
