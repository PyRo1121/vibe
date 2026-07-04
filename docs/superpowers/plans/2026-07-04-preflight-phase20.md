# Plan — Phase 20 multi-page scan

Spec: ../specs/2026-07-04-preflight-phase20-multipage.md

1. `crawl.ts` (selectCrawlTargets, crawlPages, PageFetcher) + `crawl.test.ts`
   → verify: vitest green on new module.
2. Constants: `MAX_CRAWL_PAGES`, `LEGAL_STUB_MIN_WORDS`. Export `visibleText`
   from signals for word counting.
3. `analyze.ts`: crawledPages param; verified legal checks; placeholder/secrets/
   stack sweep across pages → verify: analyze/engine tests green, legacy calls
   without crawl unchanged.
4. `engine.ts`: crawl after link extraction (parallel), pass to analyze, build
   `pagesScanned` → `types.ts` + `score.ts` pass-through.
5. UI: `PagesScannedStrip.svelte` under verdict banner; svelte-autofixer clean.
6. Fixtures: `LEGAL_PAGE_HTML` (real-length policy), URL-routing mock in
   engine tests; new tests for 404 legal link, stub page, cross-page placeholder.
7. `npm run verify` → deploy → smoke → live validation against a real site
   (expect pagesScanned + verified privacy/terms).
