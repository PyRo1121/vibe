# Preflight — Blocked scan guard

**Shipped:** When homepage HTTP status is 4xx/5xx, content checks are skipped.

## Problem

Bot-protected sites (e.g. doordash.com → HTTP 403) returned 15+ false failures (missing privacy, OG tags, etc.) from the error page HTML.

## Behavior

| Status | Action |
|--------|--------|
| 200–399 | Full scan (35+ checks) |
| 400+ | `scanCoverage: blocked` — reachable + https only |

## UX

- Amber `ScanIncompleteBanner` on results
- Verdict: *Scan incomplete — HTTP {status}…*
- Master prompt: do not fix SEO from incomplete scan
- Unlock copy: honest about blocked access

## Fixture

`GET /fixtures/blocked` → HTTP 403 for smoke tests.

## Smoke

`npm run smoke:phase18` includes blocked-scan guard checks.
