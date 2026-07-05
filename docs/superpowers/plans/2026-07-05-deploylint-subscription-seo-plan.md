# Deploylint subscription and SEO todo

Goal: keep Deploylint free and honest during alpha, while shaping the product toward a cheap monthly subscription that is worth paying for once the core scanner is reliable.

## Pricing direction

- [x] Keep all full reports free during alpha.
- [x] Show the future paid boundary in product copy without blocking the current scanner.
- [ ] Solo plan: $9/mo, 10 full reports per month, 3 saved projects, full fix prompts, exports, and before/after re-scan history.
- [ ] Builder plan: $19/mo, 25 full reports per month, 10 saved projects, deeper crawl, priority scan queue, and monitor notifications.
- [ ] Define what counts as one report: one submitted public URL with the resulting report snapshot.
- [ ] Add usage counters before enabling checkout so paid users always know what they have left.
- [ ] Revisit annual pricing after the first active alpha users tell us whether they want monthly usage or saved project limits.

## SEO focus

- [x] Generate sitemap.xml and llms.txt from the same crawlable route registry.
- [x] Keep SEO focused on real product pages rather than keyword-only landing pages.
- [x] Redirect old keyword-style SEO URLs back to canonical product pages.
- [ ] In Google Search Console, submit `https://deploylint.com/sitemap.xml`.
- [ ] Use URL Inspection for `/`, `/checks`, `/compare`, `/developers`, and `/changelog` after deployment.
- [ ] Watch Search Console query impressions weekly and add pages only when they match real search intent.
- [ ] Add comparison pages for high-intent alternatives once the core scanner and pricing copy stabilize.
- [ ] Add example-report content after saved reports exist, using sanitized fixtures rather than private user data.

## Quality gate

- [x] Every public crawlable page has a unique title, description, canonical URL, and page-specific structured data that matches visible content.
- [ ] Add FAQ schema only on pages that visibly include an actual FAQ section.
- [ ] No public route mentions GitHub as the main distribution channel until the website-first positioning is stable.
- [ ] Copy stays honest: alpha is free, some checks may break while active development continues, and paid features are previews until checkout is enabled.
