# Deploylint Tech Stack Modernization Record

Date: 2026-07-05
Status: active decision record
Scope: `C:\Users\olen\Documents\Coding\Vibe`

## Executive Decision

Deploylint should stay on its current SvelteKit + Cloudflare Workers foundation and move the bleeding-edge work into targeted product capability:

1. Add Cloudflare D1 for queryable product state.
2. Keep KV for public report cache and fast snapshots.
3. Use Cloudflare Workflows for recurring monitoring and subscriber CVE/security checks.
4. Use Cloudflare Queues when scans fan out into async enrichment, alerting, export, and notification work.
5. Add Oxlint as a fast supplemental CI gate.
6. Keep ESLint, Prettier, Svelte Check, Vitest, and Playwright until replacements prove equal on this repo.
7. Upgrade the MCP SDK when MCP work resumes.
8. Keep npm + Turbo until monorepo scale or package-boundary enforcement justifies pnpm/Nx.

This is not a conservative recommendation. It is a product-focused one. The current app stack is already on the latest public lines for the major framework/runtime packages. A framework rewrite would burn engineering time without improving the checks people pay for.

## Current Stack Inventory

Verified from `package.json`, `apps/preflight/package.json`, `apps/preflight-mcp/package.json`, `apps/preflight/wrangler.jsonc`, npm package metadata, and GitHub repository metadata on 2026-07-05.

| Layer              | Current                                       | Observed channel                                           | Decision                      |
| ------------------ | --------------------------------------------- | ---------------------------------------------------------- | ----------------------------- |
| UI framework       | Svelte `5.56.4`                               | npm `latest`                                               | Keep                          |
| App framework      | SvelteKit `2.69.1`                            | npm `latest`; `3.0.0-next.6` exists                        | Keep, track SvelteKit 3 next  |
| Cloudflare adapter | `@sveltejs/adapter-cloudflare` `7.2.9`        | npm `latest`                                               | Keep                          |
| Bundler/dev server | Vite `8.1.3`                                  | npm `latest`                                               | Keep                          |
| Language           | TypeScript `6.0.3`                            | npm `latest`; `7.0.1-rc` exists                            | Keep, track TS 7 RC only      |
| CSS                | Tailwind `4.3.2` + `@tailwindcss/vite`        | npm `latest`                                               | Keep                          |
| Runtime/deploy     | Cloudflare Workers + Wrangler `4.107.0`       | npm `latest`                                               | Keep                          |
| Worker types       | `@cloudflare/workers-types` `5.20260705.1`    | npm `latest`                                               | Keep                          |
| Monorepo tasks     | Turbo `2.10.3`                                | npm `latest`; canary exists                                | Keep                          |
| Package manager    | npm `11.18.0` workspaces                      | latest line                                                | Keep for now                  |
| Unit tests         | Vitest `4.1.9`                                | npm `latest`; `5.0.0-beta.5` exists                        | Keep, track beta              |
| Browser tests      | Playwright `1.60.0` in repo, `1.61.1` current | update normally                                            |
| Lint               | ESLint `10.6.0` + typescript-eslint `8.56.1`  | ESLint current, ts-eslint slightly behind current `8.62.1` | Keep, update                  |
| Format             | Prettier `3.8.1`                              | current `3.9.4`, v4 alpha exists                           | Keep, update                  |
| MCP                | `@modelcontextprotocol/sdk` `1.12.1`          | current `1.29.0`                                           | Upgrade when MCP work resumes |
| Validation         | Zod `4.4.3`                                   | npm `latest`                                               | Keep                          |

## Replacement Matrix

### SvelteKit vs TanStack Start, Astro, Next, Hono-only Workers

Bleeding-edge candidates:

- SvelteKit 3 next.
- TanStack Start / TanStack Router.
- Astro 7.
- Next 16 canary/preview.
- Hono-only Cloudflare Worker.

Decision: keep SvelteKit for the product shell.

Why:

- Deploylint already uses SvelteKit server routes, Svelte components, Svelte Check, and the Cloudflare adapter successfully.
- SvelteKit has official Cloudflare adapter support for Workers/Pages-style deployments and exposes Cloudflare bindings through `platform.env` in app code.
- A Hono-only rewrite is attractive for small APIs, but Deploylint is a full product UI plus API. Hono is better as a future internal service boundary, not a replacement for the app shell.
- Astro would be strong for content-heavy marketing pages, but Deploylint's first screen is an interactive scanner.
- Next is powerful, but Cloudflare deployment adds a different compatibility layer and does not improve scanner accuracy.
- TanStack Start is interesting, but it would introduce React and a rewrite without replacing any current product bottleneck.

Adoption trigger for SvelteKit 3:

- `npm run verify:preflight` and `npm run verify:mcp` pass.
- Cloudflare adapter release notes show no blocking Worker regressions.
- A one-page smoke checklist passes: homepage, scan API, report permalink, checkout route, webhook route, sitemap, robots, `llms.txt`.

### Vite/Rolldown/OXC

Decision: keep Vite 8 and watch Rolldown/OXC integration closely.

Why:

- Vite is already at `8.1.3`, the current line in this repo.
- The ecosystem direction is toward Rolldown/OXC/VoidZero primitives, but the safest way to consume that is through Vite releases first.
- Replacing Vite directly with experimental bundler wiring would create integration risk with SvelteKit, Cloudflare adapter output, and the Worker build path.

Action:

- Do not add custom Rolldown config unless a specific build-time bottleneck is measured.
- Keep an issue/plan open for Vite beta/canary trials in an isolated branch.

### ESLint/Prettier vs Biome/Oxlint/OXC

Decision: add Oxlint as a supplemental gate; keep ESLint/Prettier for now.

Why:

- Oxlint is high-value because it is fast and catches JavaScript/TypeScript issues from the OXC ecosystem.
- Biome is a credible formatter/linter and should be evaluated, but Svelte formatting/linting and Tailwind class sorting are already integrated through Prettier plugins.
- ESLint still carries Svelte-specific and project-specific rules that should not be dropped without coverage parity.

Near-term implementation:

```json
{
  "scripts": {
    "lint:fast": "oxlint .",
    "lint": "prettier --check . && eslint . && oxlint ."
  },
  "devDependencies": {
    "oxlint": "^1.72.0"
  }
}
```

Acceptance:

- `npm.cmd run verify:preflight` passes.
- Oxlint findings are either fixed or suppressed with a narrow config file.
- No existing ESLint/Svelte/Prettier coverage is removed in the first pass.

### npm vs pnpm vs Bun

Decision: keep npm for now; pnpm is the plausible future switch; Bun is not the right package-manager replacement yet.

Why:

- npm 11 workspaces are already working and `packageManager` is pinned.
- Switching package managers creates lockfile churn and CI/deploy churn before it creates product value.
- pnpm would improve deterministic workspace installs and disk efficiency if the monorepo grows.
- Bun is compelling as runtime/tooling, but the current app deploys to Cloudflare Workers, not Bun runtime. Using Bun only as a package manager adds a second operational model without clear return.

Adoption trigger for pnpm:

- More shared packages.
- Repeated npm workspace pain.
- Need for stricter dependency isolation.
- Clean one-branch proof: `pnpm install`, `pnpm run verify`, Cloudflare deploy smoke.

### Turbo vs Nx

Decision: keep Turbo.

Why:

- The monorepo is small and already uses Turbo scripts effectively.
- Nx would help if Deploylint grows into many apps/packages with generators, ownership rules, affected graph enforcement, and plugin-managed CI.
- Today, Nx is mostly process overhead.

Adoption trigger for Nx:

- More than 8-10 packages/apps.
- Repeated accidental cross-package breakage.
- Need enforced module boundaries and generated package scaffolds.

### KV vs D1 vs Durable Objects

Decision: split storage by access pattern.

Use D1 for:

- Users/accounts.
- Projects/monitored targets.
- Scan history.
- Subscription entitlements.
- Notification settings.
- Alert events.
- Queryable security/CVE history.

Use KV for:

- Public report snapshots.
- Shareable permalink cache.
- Low-write public metadata.
- Generated static crawler/LLM surfaces if needed.

Use Durable Objects for:

- Rate limits.
- Counters.
- Per-target coordination if concurrent scans become a problem.

Why:

- KV is eventually consistent and not a relational query store.
- D1 is a better fit for report history, account state, alert state, and monitoring queries.
- Durable Objects are best for coordination and strongly ordered state around one object, not general reporting tables.

### Workflows and Queues

Decision: adopt when monitoring becomes real.

Use Workflows for:

- Scheduled repo/site monitoring.
- Retryable CVE/security snapshot runs.
- Long-running scan orchestration.
- Durable state transitions for notification workflows.

Use Queues for:

- Scan fanout.
- Notification send jobs.
- Export/SARIF generation.
- Background enrichment such as OSV, SBOM, and GitHub Actions analysis.

Do not use them yet for synchronous `/api/scan` requests. Keep the public scan path direct until background work is clearly needed.

### MCP SDK

Decision: upgrade `@modelcontextprotocol/sdk` from `1.12.1` to current `1.29.0` when MCP work resumes.

Why:

- MCP is not the immediate product bottleneck.
- The SDK is far behind current, so upgrading before serious MCP work avoids building against old APIs.
- The MCP package is isolated enough for a focused upgrade pass.

Acceptance:

- `npm.cmd run verify:mcp` passes.
- Existing MCP binary names still work: `deploylint-mcp` and `preflight-mcp`.
- Any protocol/API changes are documented in `apps/preflight-mcp/README.md` or a dedicated plan.

### Security Scanner Engines

Decision: use proven engines as sources and benchmarks, but keep Deploylint's value layer.

Candidate engines:

- OSV Scanner for dependency vulnerabilities.
- zizmor for GitHub Actions security.
- Trivy for dependency/container/filesystem scanning.
- Semgrep for source security rules.
- OpenSSF Scorecard for repo supply-chain posture.
- CycloneDX/SPDX for SBOM recognition/export.
- SARIF for GitHub code-scanning export.

Why not just wrap all of them:

- Users do not pay for raw scanner output.
- Raw outputs are noisy and fragmented.
- Deploylint's value is launch judgment: what blocks launch, what can wait, and what exact fix to make first.

Near-term scanner model:

```ts
interface DeploylintFinding {
  id: string;
  source: "deploylint" | "osv" | "zizmor" | "trivy" | "semgrep" | "scorecard";
  category: "security" | "repo" | "ci" | "dependency" | "launch";
  severity: "info" | "low" | "medium" | "high" | "critical";
  launchPriority: "blocker" | "fix-soon" | "watch";
  status: "pass" | "warn" | "fail";
  path?: string;
  line?: number;
  message: string;
  evidence?: string;
  fixPrompt?: string;
  sarifRuleId?: string;
}
```

## Recommended Implementation Order

### Phase 1: Toolchain Signal Without Rewrites

Goal: improve CI signal without changing product architecture.

1. Add `oxlint` as `lint:fast`.
2. Run it non-destructively.
3. Fix high-confidence issues.
4. Keep ESLint/Prettier/Svelte Check.

Verification:

```powershell
npm.cmd run verify:preflight
npm.cmd run verify:mcp
```

### Phase 2: D1 Monitoring Foundation

Goal: make saved reports, monitors, subscriptions, and alert history queryable.

1. Add D1 binding to `apps/preflight/wrangler.jsonc`.
2. Add migration files for accounts/projects/scans/alerts.
3. Keep KV report snapshots.
4. Add D1-backed stores behind interfaces.

Verification:

```powershell
npm.cmd run verify:preflight
npm.cmd exec -w preflight -- wrangler d1 migrations list deploylint
```

### Phase 3: Security Engine Integration Plan

Goal: improve scanner depth without turning Deploylint into noisy glue.

1. Add internal SARIF-ready finding model.
2. Add high-confidence check IDs for OSV/zizmor/SBOM/Scorecard-style findings.
3. Start with static parsing and API-safe checks.
4. Queue heavyweight scanner execution later.

Verification:

```powershell
npm.cmd exec -w preflight -- vitest run src/lib/scan/repo
npm.cmd run verify:preflight
```

### Phase 4: Workflows/Queues Monitoring

Goal: recurring CVE/security checks for paid subscribers.

1. Use Workflows for durable monitor runs.
2. Use Queues for notification/export fanout.
3. Store event history in D1.
4. Keep alpha copy honest while the system is under active development.

Verification:

```powershell
npm.cmd run verify:preflight
npm.cmd run deploy:preflight
npm.cmd run smoke:preflight
```

### Phase 5: MCP SDK Upgrade

Goal: modernize MCP after the website/scanner value is stronger.

1. Upgrade `@modelcontextprotocol/sdk`.
2. Adjust MCP server code to current APIs.
3. Verify local MCP binary behavior.
4. Update developer docs.

Verification:

```powershell
npm.cmd run verify:mcp
```

## Things We Should Not Do Yet

- Do not rewrite the app from SvelteKit to Next, Astro, TanStack Start, or Hono.
- Do not replace ESLint/Prettier with Biome in one jump.
- Do not switch to Bun for deploy/runtime assumptions.
- Do not replace Turbo with Nx until monorepo scale demands it.
- Do not execute heavyweight scanners inside synchronous Worker requests.
- Do not make all scanner findings launch blockers.

## Open Decision: Free Alpha vs Paid Mode

Earlier product direction says Deploylint should remain free while under active alpha development, while showing future pricing and hidden-later features. If `ALPHA_FREE_UNLOCK` is set to `false`, production becomes a paid/locked flow. That should be an explicit product decision, not an incidental stack change.

Current recommendation:

- Keep alpha reports unlocked until the scanner and monitoring value are materially stronger.
- Build subscription plumbing behind the scenes.
- Gate only when Stripe price IDs, Terms copy, webhook fulfillment, monitoring limits, and unlock UX are all verified together.

## Source Links

Framework/runtime:

- SvelteKit Cloudflare adapter docs: https://svelte.dev/docs/kit/adapter-cloudflare
- Cloudflare SvelteKit guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/
- Vite 8 beta / Rolldown direction: https://voidzero.dev/posts/announcing-vite-8-beta
- Vite GitHub repository: https://github.com/vitejs/vite
- SvelteKit GitHub repository: https://github.com/sveltejs/kit
- Hono GitHub repository: https://github.com/honojs/hono
- Astro GitHub repository: https://github.com/withastro/astro
- Next.js GitHub repository: https://github.com/vercel/next.js
- TanStack Router GitHub repository: https://github.com/TanStack/router

Cloudflare platform:

- Cloudflare Workers SDK / Wrangler repository: https://github.com/cloudflare/workers-sdk
- Cloudflare D1 docs: https://developers.cloudflare.com/d1/
- Cloudflare KV consistency model: https://developers.cloudflare.com/kv/concepts/how-kv-works/
- Cloudflare Durable Objects docs: https://developers.cloudflare.com/durable-objects/
- Cloudflare Workflows docs: https://developers.cloudflare.com/workflows/
- Cloudflare Queues docs: https://developers.cloudflare.com/queues/

Toolchain:

- Biome docs: https://biomejs.dev/
- Biome GitHub repository: https://github.com/biomejs/biome
- Oxlint/OXC docs: https://oxc.rs/docs/guide/usage/linter
- OXC GitHub repository: https://github.com/oxc-project/oxc
- Bun GitHub repository: https://github.com/oven-sh/bun

Security/scanner ecosystem:

- OSV Scanner docs: https://google.github.io/osv-scanner/
- OSV Scanner GitHub repository: https://github.com/google/osv-scanner
- zizmor docs: https://docs.zizmor.sh/
- zizmor GitHub repository: https://github.com/zizmorcore/zizmor
- Trivy docs: https://trivy.dev/
- Semgrep GitHub repository: https://github.com/semgrep/semgrep
- OpenSSF Scorecard: https://scorecard.dev/
- GitHub SARIF support: https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning
- CycloneDX specification overview: https://cyclonedx.org/specification/overview/
- SPDX specifications: https://spdx.dev/use/specifications/

MCP:

- Model Context Protocol TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
