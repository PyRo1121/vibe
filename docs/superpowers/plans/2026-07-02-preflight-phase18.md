# Preflight Phase 18 — Validation

**Goal:** Prove the wedge converts before building Phase 19+.

## Shipped in Phase 18

- Conversion-focused homepage + unlock offer (`buildUnlockOffer`)
- Unlock panel mid-funnel + mobile sticky bar
- Post-unlock 3-step guide (copy → fix → re-scan)
- OG image live HEAD check (`og-image-live`)

## Exit criteria

Automated: `npm run smoke:phase18` (from `apps/preflight`).

Manual smoke on production:

1. Scan URL with issues → see embarrassment + locked prompt count ✅ automated
2. Checkout test → master prompt + re-scan delta — **human:** pay with test card `4242…`, return with `?checkout=success&session_id=…`, confirm master prompt + re-scan delta
3. Broken og:image URL → fails `og-image-live` + social preview warning ✅ automated via `/fixtures/bad-og`

## Phase 18 ops loop (in order)

1. **Plausible** — script wired (`PUBLIC_PLAUSIBLE_DOMAIN`). Register site at [plausible.io](https://plausible.io) for `preflight.latham.cloud`.
2. **Smoke** — `npm run smoke:phase18` (must pass 12/12 after deploy).
3. **Webhook** — `npm run stripe:test-webhook` → confirm `checkout_paid` in CF Observability (`preflight_funnel`).
4. **Human checkout** — one test payment → unlock → re-scan → score delta shown.
5. **Watch 30–45 days** — aggregate funnel events; apply kill-metric gates before Phase 19.

## Kill metrics (from Phase 3 spec)

Track for 30–45 days after Phase 18 deploy:

- Daily scans
- Unlock conversion (free scan → paid)
- Re-scan rate within 24h of unlock

### How to read funnel logs

Server and client emit structured JSON with `"type":"preflight_funnel"`.

Search Cloudflare Observability logs for `preflight_funnel` and aggregate by `event`:

| Event | Meaning |
|-------|---------|
| `scan_completed` | Free or paid scan finished |
| `rescan_completed` | Unlocked user re-scanned (includes `scoreDelta` when available) |
| `unlock_click` | User clicked unlock / checkout CTA |
| `checkout_started` | Stripe session created |
| `checkout_paid` | Stripe webhook confirmed payment |

Optional: set `PUBLIC_PLAUSIBLE_DOMAIN=preflight.latham.cloud` in wrangler vars for Plausible custom events (same event names).

Privacy: payloads include verdict/score counts only — not scanned URLs.

## Next phase gate

| Metric | Phase 19 |
|--------|----------|
| Unlocks + re-scans healthy | Live Stripe, marketing, optional bundle crawl |
| 0 unlocks | Copy/offer pivot only — no new checks |
| Unlocks, no re-scans | Prompt quality + UX only |
