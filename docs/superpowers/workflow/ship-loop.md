# Ship Loop — CTO / Engineer / QC / Testing

Repeat until `npm run verify` passes and deploy succeeds.

## Roles

| Role | Responsibility | Output |
|------|----------------|--------|
| **CTO** | Product spec, architecture, phase boundaries, accept/reject gates | Spec + plan updates, phase brief |
| **Senior Engineer** | Implement one phase; minimal diff; match conventions | Code + self-review notes |
| **QC** | Spec compliance, security, scope creep, code quality | Pass/fail + fix list |
| **Testing** | Tests, edge cases, `npm run verify`, regression | Pass/fail + failing test names |

## Loop (one phase)

```
CTO brief → Engineer implements → QC review → Testing verify
                ↑                      |            |
                └──── fix loop ────────┴────────────┘
```

**Exit criteria per phase:** QC ✅ AND Testing ✅ (`npm run verify:preflight` green)

**Ship criteria:** All phases green + `npm run deploy:preflight` succeeds.

## Monorepo (Turborepo)

```
Vibe/
  apps/
    preflight/    — site readiness audit (Preflight)
    tcg-vault/    — TCG collection tracker
  packages/       — shared libs (future)
  docs/
  turbo.json
```

Root commands:
- `npm run verify` — all apps
- `npm run verify:preflight` / `verify:tcg-vault` — one app
- `npm run dev:preflight` — local dev
- `npm run deploy:preflight` — ship one wedge

## Handoff formats

### CTO → Engineer
- Phase number + goal (1 sentence)
- Files to create/modify
- Non-goals for this phase
- Link to spec section

### Engineer → QC
- Files changed
- Design decisions
- Known limitations

### QC → Engineer (on fail)
- `path:line` issues tagged BLOCKER | IMPORTANT | NIT
- Spec gaps explicitly listed

### Testing → Engineer (on fail)
- Failing command output
- Missing test cases (concrete inputs/expected)

## Phases (Preflight MVP)

1. **Scaffold** — SvelteKit 5, Cloudflare adapter, Tailwind, Vitest, verify script
2. **Scan core** — types, url-guard, parse, analyze, score, engine (injectable deps)
3. **API** — POST `/api/scan`, SSRF guard, body limits, error shapes
4. **UI** — professional landing, scan flow, results, blurred fix prompts
5. **Monetization stub** — unlock CTA + prompt pack (no Stripe v1 — checkout stub)
6. **Ship** — wrangler deploy, smoke test production URL
