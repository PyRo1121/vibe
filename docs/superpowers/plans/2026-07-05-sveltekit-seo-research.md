# SvelteKit SEO research - July 5, 2026

Goal: keep Deploylint aligned with current SvelteKit and Google Search guidance without turning the site into keyword stuffing or thin SEO pages.

## Current standard

World-class SvelteKit SEO in 2026 is not a separate trick layer. It is a fast, server-rendered, crawlable product site with honest page-specific metadata, canonical URLs, useful visible content, and structured data that accurately describes that visible content.

For Deploylint, that means:

- Keep SSR enabled for every indexable page. SvelteKit renders on the server by default, and SvelteKit's own SEO docs still recommend leaving SSR on because server-rendered content is indexed more reliably.
- Use `<svelte:head>` for each page's title, description, canonical URL, robots directives, social preview tags, and JSON-LD. Svelte exposes this head content during SSR, which keeps crawlers from depending on client-side hydration for critical metadata.
- Use prerendering or disabled CSR only where it improves speed without hiding interactive functionality. Static marketing and policy pages can be very lean; the scanner itself should remain functional.
- Maintain one source of truth for crawlable routes, sitemap generation, and `llms.txt` so Google, AI search surfaces, and users see the same public surface area.
- Use JSON-LD because Google recommends it as the easiest structured data format to maintain, but only include complete and accurate facts that are also represented on the page.
- Avoid meta keywords, hidden keyword blocks, doorway pages, and large sets of thin pages for query variants. Google does not use the meta keywords tag for ranking, and its generative AI search guidance explicitly warns against making separate pages for every possible search variation.
- Treat AI search optimization as ordinary technical SEO plus people-first content. Google's generative AI features rely on indexed, crawlable Search content, so the winning path is useful product pages and clear technical structure, not separate "GEO" hacks.
- Keep report pages `noindex, follow` until user-facing saved reports are intentionally public. Generated scan pages can still pass link discovery while staying out of the index.
- Keep sitemap cache short during alpha deploys so Search Console rechecks pick up routing and metadata changes quickly.

## Implemented for Deploylint

- Shared SEO helpers now live in `apps/preflight/src/lib/site/seo-metadata.ts`.
- `SeoHead.svelte` now emits canonical links, robots/googlebot directives, Open Graph/Twitter image metadata, locale/site metadata, and JSON-LD.
- Public pages use shared title, image, and JSON-LD builders instead of hand-written repeated metadata.
- Keyword-style legacy URLs now 301 to real product pages instead of staying in the sitemap or `llms.txt`.
- The sitemap and `llms.txt` registry now contains only real product, comparison, developer, changelog, legal, and scanner pages.
- Generated report pages are explicitly `noindex, follow`.

## Backlog

- After deploy, submit `https://deploylint.com/sitemap.xml` in Google Search Console and run URL Inspection for `/`, `/checks`, `/compare`, `/developers`, and `/changelog`.
- Run Google's Rich Results Test on the home page and one secondary page after deployment.
- Add comparison or example-report pages only when they serve real buyer intent and contain original Deploylint analysis.
- Add image optimization with SvelteKit's recommended image tooling when the site introduces product screenshots or visual report examples.
