# Preflight Phase 20 — Multi-page scan (launch-bar item 1)

Date: 2026-07-04
Status: In progress

## Problem

Every check only sees the homepage. "Privacy policy: pass" means "I saw a footer
link," not "I read the policy." Placeholder copy, secrets, and Stripe signals on
`/pricing`, `/privacy`, or `/terms` are invisible. A paid report built on one page
feels thin and can be wrong — both violate the launch bar (no traffic until the
scan is genuinely beneficial).

## Goals

1. Crawl up to 3 targeted same-origin pages found on the homepage: privacy,
   terms, pricing. Parallel fetches, per-page failure tolerance.
2. Upgrade `privacy` / `terms` checks from link-detection to content verification:
   - link missing → unchanged (fail / warn)
   - link → 404/410 → **fail** (broken legal link is a launch embarrassment)
   - link → other 4xx/5xx or fetch error → **warn**, honestly worded ("could not verify")
   - page under ~120 words of visible text → **warn** (stub)
   - real content → **pass** with word count evidence
3. Sweep placeholder copy and secret patterns across all fetched pages, labeling
   findings with the page path.
4. Detect Stripe/Supabase/Firebase stack signals across all pages (Stripe often
   loads only on /pricing).
5. Report lists `pagesScanned` (role, URL, status); UI shows the coverage strip so
   users see the scan read more than one page.

## Non-goals (v1)

- Full-site crawling / sitemap-driven crawl.
- Contact page verification (mailto/forms — low signal).
- Repo-source scanning (GitHub). **Architecture note:** the engine's injectable
  `ScanDeps` fetch layer is the seam for a future repo adapter (map repo files →
  pages/assets). Nothing in this phase may assume the source is a live site
  beyond that seam.
- Live Stripe, durable report links (separate launch-bar items).

## Design

- `src/lib/scan/crawl.ts` — pure `selectCrawlTargets(links, base)` (role regexes,
  same-origin, one URL per role) + `crawlPages(targets, fetchPage)` (parallel,
  per-page try/catch, visible word count). `PageFetcher` is a local structural
  type so engine ↔ crawl stays acyclic.
- `analyze.ts` gains an optional `crawledPages` param; legal checks and
  placeholder/secrets/stack sweeps consume it. Without crawl data all behavior
  is unchanged (backward compatible).
- `types.ts`: `ScannedPage { url, role, status }`, `ScanReport.pagesScanned?`.
- Budget: +3 parallel page fetches max (12s timeout each, existing limits apply).
  Blocked scans never crawl.

## Exit criteria

1. Unit tests: target selection, crawl failure tolerance, all five legal-check
   outcomes, cross-page placeholder/secret detection.
2. Existing tests still pass (link-only fallback preserved).
3. Production scan of a real site shows pagesScanned with verified legal pages.
4. `verify` + deploy + smoke green.
