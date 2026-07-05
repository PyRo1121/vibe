# Deploylint — Cloudflare Free tier guardrails

Deploylint (`apps/preflight`) is intentionally sized for the **Workers Free** plan. Do not enable Workers Paid or add billable bindings unless you deliberately upgrade.

## Hard limits (Free)

| Resource | Free limit | How we stay under |
|----------|------------|-------------------|
| Worker requests | 100,000/day | Global scan cap (175/day), IP rate limits, cached Plausible script |
| Worker subrequests | 50/invocation | Tuned probe constants in `constants.ts` (~≤50 fetches/scan) |
| KV writes | 1,000/day | Scan cap (~4 writes/scan × 175 ≈ 700) + headroom for unlocks |
| KV reads | 100,000/day | TTL on all keys; history capped at 20 entries |
| Workers AI neurons | 10,000/day | Copy review **paid-only** + 25 reviews/day cap |
| CPU time | 10 ms/invocation | No heavy compute; scans are I/O-bound |

## Code knobs

| File | Purpose |
|------|---------|
| `src/lib/server/usage-budget.ts` | Daily scan cap, AI cap, Plausible event cap |
| `src/lib/server/rate-limit.ts` | 15 scans / IP / 5 min |
| `src/lib/scan/constants.ts` | Probe depth sized for 50 subrequests |
| `src/lib/server/copy-review.ts` | Unlocked scans only; fails open |
| `src/lib/server/report-store.ts` | 90-day report TTL; 180-day history TTL |

## Monitoring

1. **Workers dashboard** → Analytics → requests (watch for Error 1027 = daily limit).
2. **KV dashboard** → operations (reads/writes).
3. **Workers AI** → Neurons used today.

Set Cloudflare notifications for Workers errors if available on your account.

## If you outgrow Free

Signs: sustained 175+ scans/day, Error 1027, KV write failures, or AI reviews dropping.

Options (in order):

1. Raise caps in `usage-budget.ts` **only after** upgrading to Workers Paid.
2. Move report storage off KV (R2/D1) — requires Paid or different architecture.
3. Disable Workers AI copy review (`remove ai binding` in `wrangler.jsonc`).

See also: [cloudflare-firewall.md](./cloudflare-firewall.md) (DDoS + WAF + edge rate limits)

- R2, D1, Queues, Durable Objects
- Cron triggers on this Worker
- Extra KV namespaces
