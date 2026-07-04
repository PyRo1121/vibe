# Preflight MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development per phase. Ship loop: CTO → Engineer → QC → Testing until green.

**Goal:** Ship Preflight — professional URL audit with free score/checklist and paid AI fix prompts — on Cloudflare Workers.

**Architecture:** SvelteKit 5 SPA + API route; pure scan modules in `$lib/scan` with injectable fetch; SSRF-hardened engine; Vitest for unit/integration tests.

**Tech Stack:** SvelteKit 5, Cloudflare adapter, Tailwind 4, TypeScript, Vitest, Wrangler

**Spec:** `docs/superpowers/specs/2026-07-02-preflight-design.md`

---

## File map

```
apps/preflight/
  src/lib/scan/types.ts       — ScanReport, Check, categories
  src/lib/scan/url-guard.ts   — SSRF validation
  src/lib/scan/validate.ts    — API body parsing
  src/lib/scan/parse.ts       — HTML parse, secrets
  src/lib/scan/analyze.ts     — content checks
  src/lib/scan/score.ts       — scoring + report builder
  src/lib/scan/prompts.ts     — fix prompt templates per check id
  src/lib/scan/engine.ts      — orchestration, fetch, redirects
  src/routes/api/scan/+server.ts
  src/routes/+page.svelte
  wrangler.jsonc
  vitest.config.ts
```

---

## Phase 1: Scaffold

**CTO brief:** Fresh SvelteKit project at `preflight/`. Cloudflare adapter, Tailwind, Vitest, `npm run verify` = check + test + build.

- [ ] Create project: `npm create svelte@latest preflight` (minimal, TS, Tailwind, no demo)
- [ ] Add `@sveltejs/adapter-cloudflare`, wrangler, vitest, workers-types
- [ ] Add scripts: `test`, `verify`, `deploy`
- [ ] Add `vitest.config.ts` with `$lib` alias
- [ ] Empty test `src/lib/scan/smoke.test.ts` passes
- [ ] `npm run verify` exits 0

---

## Phase 2: Scan core

**CTO brief:** All scan logic testable without network. TDD per module.

- [ ] `types.ts` — CheckStatus, Check, ScanReport, categories
- [ ] `url-guard.ts` + tests — HTTPS, block 127.0.0.1, 10.x, 169.254.169.254, localhost
- [ ] `parse.ts` + tests — title, meta, og, h1, links, findSecrets (no placeholder false positives)
- [ ] `analyze.ts` + tests — buildContentChecks for legal, a11y, mobile, seo
- [ ] `score.ts` + tests — weighted score, unreachable caps score
- [ ] `engine.ts` + tests — injectable deps, redirect re-validation, 2MB cap

---

## Phase 3: API

- [ ] `validate.ts` + tests — parseScanRequestBody, body size limit
- [ ] `+server.ts` — POST handler, 400 on bad URL, JSON ScanReport
- [ ] Integration test calling handler with mock engine (optional) or engine unit coverage

---

## Phase 4: UI

- [ ] Professional landing copy per spec (Preflight branding)
- [ ] URL input `type="text" inputmode="url"`, AbortController on rescan
- [ ] Results: score, categories, pass/warn/fail icons
- [ ] Fix prompts blurred; unlock CTA stub ($9 one-time)
- [ ] `role="alert"` on errors, meta/OG on layout

---

## Phase 5: Prompts + polish

- [ ] `prompts.ts` — template string per check id
- [ ] Wire prompts into report (locked until paid flag — client-side stub ok for MVP)
- [ ] Svelte autofixer clean

---

## Phase 6: Ship

- [ ] `wrangler.jsonc` name `preflight`
- [ ] `npm run verify` green
- [ ] `npm run deploy`
- [ ] Smoke: POST scan to production with public URL

---

## Verify command

```bash
npm run verify:preflight
# or from repo root: npm run verify -- --filter=preflight
```

Expected: svelte-check 0 errors, all tests pass, build success.
