# Cloudflare firewall — Deploylint / latham.cloud

Two layers: **zone firewall** (Cloudflare edge, blocks traffic before your Worker) and **Worker edge security** (in-app rate limits + headers).

## Layer 1 — Zone firewall (API script)

Automatic **L3/L4 DDoS mitigation** is always on for Cloudflare zones. This script configures the rest.

### One-time setup

1. Create an API token: [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → Custom token
   - **Permissions:** Zone · Zone · Read, Zone · Zone Settings · Edit, Zone · Firewall Services · Edit
   - **Zone Resources:** Include · Specific zone · `latham.cloud`

2. Run:

```powershell
$env:CLOUDFLARE_API_TOKEN = "your-token"
npm run setup:cloudflare-firewall -w preflight
```

### What the script applies

| Setting | Value | Why |
|---------|-------|-----|
| Security Level | Medium | Balance UX vs automated threats |
| Browser Integrity Check | On | Blocks some headless abuse |
| Always Use HTTPS | On | No plaintext cookies |
| Min TLS | 1.2 | Drop ancient clients |
| TLS 1.3 | On | Faster + safer handshakes |
| Bot Fight Mode | On | Free bot mitigation |
| SSL mode | Full | Encrypt visitor ↔ Cloudflare |

### WAF custom rules (5/5 on Free)

| Rule | Action |
|------|--------|
| Exploit probes (`/.env`, `/.git`, `/wp-*`, etc.) | Block |
| TRACE / TRACK / CONNECT | Block |
| Path traversal in query string | Block |
| POST `/api/*` with empty User-Agent (except Stripe webhook) | Block |
| Known scanner User-Agents (sqlmap, nikto, …) | Block |

Rules are tagged `deploylint:*` so re-running the script is idempotent.

> **Note:** Wrangler OAuth (`npx wrangler whoami`) is **read-only** for zone firewall. You need `CLOUDFLARE_API_TOKEN` for this script.

## Layer 2 — Worker edge (always on)

Shipped in the app — no dashboard step.

| Control | Where |
|---------|--------|
| Block exploit paths | `edge-security.ts` + `hooks.server.ts` |
| API rate limits (checkout, events, webhooks) | `edge-security.ts` |
| Scan rate limit (15 / 5 min / IP) | `rate-limit.ts` |
| Daily scan + AI caps | `usage-budget.ts` |
| Security headers (HSTS, X-Frame-Options, …) | `hooks.server.ts` |
| Max POST body 256 KB | `edge-security.ts` |

See also: [cloudflare-free-tier.md](./cloudflare-free-tier.md)

## Monitoring

- **Security** → Events — blocked/challenged requests
- **Analytics** → Traffic — spikes (DDoS shows as elevated requests)
- **Workers** → Error 1027 — daily request cap (see free-tier doc)

## TCG Vault (`vault.latham.cloud`)

Same zone (`latham.cloud`) — zone rules protect both hostnames. Worker limits on `lint.latham.cloud` paths only; vault has its own Worker without scan API abuse surface.
