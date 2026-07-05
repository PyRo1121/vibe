# DeployLint Oxlint Biome Toolchain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the DeployLint lint/format/test/build toolchain without destabilizing SvelteKit app behavior.

**Architecture:** Add Oxlint as a supplemental CI linter first, keep ESLint and Prettier as the source of truth while Svelte template coverage and Tailwind class sorting still depend on them, and evaluate Biome in an isolated branch before it owns formatting or linting. Keep Vitest and Playwright on stable releases; prerelease test runners are not justified for this production checkout.

**Tech Stack:** npm workspaces, Turbo, SvelteKit, Vite, TypeScript, ESLint flat config, Prettier, Oxlint, optional Biome, Vitest, Playwright.

---

## Current State

Files inspected:

- `package.json`
- `apps/preflight/package.json`
- `apps/preflight/eslint.config.js`
- `apps/preflight/.prettierrc`
- `apps/preflight/.prettierignore`
- `apps/preflight/vite.config.ts`
- `apps/preflight/playwright.config.ts`
- `turbo.json`
- Adjacent `apps/tcg-vault/*` toolchain configs for monorepo consistency only.

Current DeployLint scripts:

```json
{
  "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
  "lint": "prettier --check . && eslint .",
  "format": "prettier --write .",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "verify": "npm run sync:gate-remote && npm run check && npm run lint && npm run test && npm run build",
  "build": "vite build && node scripts/export-durable-objects.mjs"
}
```

Current package versions observed on 2026-07-05:

```text
eslint: 10.6.0 in apps/preflight/package.json and npm latest
prettier: 3.8.1 in apps/preflight/package.json; npm latest is 3.9.4
vitest: 4.1.9 in apps/preflight/package.json and npm latest; npm beta is 5.0.0-beta.5
@playwright/test: 1.60.0 in apps/preflight/package.json; npm latest is 1.61.1; npm next is 1.62.0-alpha-2026-07-05
oxlint: npm latest is 1.72.0
@biomejs/biome: npm latest is 2.5.2
```

## Recommendation

1. Add Oxlint now as supplemental CI, not as a replacement for ESLint.
2. Keep ESLint because the current config uses `eslint-plugin-svelte`, Svelte parser integration, TypeScript rules, and Svelte-specific rules. Oxlint currently lints Svelte framework files by inspecting only `<script>` blocks, so it is not a full substitute for Svelte template linting.
3. Keep Prettier because this app uses `prettier-plugin-svelte` and `prettier-plugin-tailwindcss` with `tailwindStylesheet`. Tailwind's official Prettier plugin remains the clearest supported path for class sorting in this stack.
4. Evaluate Biome only in a separate branch as an optional linter/formatter layer. Biome v2 supports Svelte, but its docs still mark Vue/Svelte/Astro super-language support as experimental and subject to changes.
5. Do not move Vitest to prerelease. DeployLint already has Vitest 4.1.9, which is latest stable. Vitest 5.0 is beta and its migration guide explicitly says the breaking-change section is work in progress.
6. Do not move Playwright to `next` or `beta`. Upgrade to latest stable `@playwright/test@1.61.1` later if the browser install and e2e suite pass. Canary releases are useful for testing unreleased Playwright features, not for a normal production verify path.

## Sources

- Oxlint overview and support: https://oxc.rs/docs/guide/usage/linter
- Oxlint config and CLI flags: https://oxc.rs/docs/guide/usage/linter/config.html and https://oxc.rs/docs/guide/usage/linter/cli.html
- Biome overview, migration, and CLI docs: https://biomejs.dev/, https://biomejs.dev/guides/migrate-eslint-prettier/, and https://biomejs.dev/reference/cli/
- Biome language support: https://biomejs.dev/internals/language-support/
- Tailwind class sorting with Prettier: https://tailwindcss.com/docs/editor-setup#class-sorting-with-prettier and https://github.com/tailwindlabs/prettier-plugin-tailwindcss
- Vitest v4 and v5 migration docs: https://vitest.dev/guide/migration.html and https://main.vitest.dev/guide/migration.html
- Playwright release, browser, and canary docs: https://playwright.dev/docs/release-notes, https://playwright.dev/docs/browsers, and https://playwright.dev/docs/canary-releases

## Planned File Changes

- Modify: `package.json`
  - Add root scripts for supplemental toolchain checks.
  - Add `oxlint` as a root devDependency.
  - Add `@biomejs/biome` only if the optional Biome evaluation task is approved.
- Modify: `apps/preflight/package.json`
  - Add `lint:oxlint`.
  - Add `lint:biome` only in the optional evaluation branch.
  - Change `verify` only after Oxlint has a clean baseline.
  - Update stable Playwright later if E2E install and tests pass.
- Create: `apps/preflight/.oxlintrc.json`
  - Commit a minimal, strict-enough supplemental Oxlint config.
- Optional create: `biome.json`
  - Keep formatter disabled during evaluation unless a formatting diff review is explicitly accepted.
- Do not modify app source code for this modernization.

## Task 1: Add Oxlint As Supplemental CI

**Files:**

- Modify: `package.json`
- Modify: `apps/preflight/package.json`
- Create: `apps/preflight/.oxlintrc.json`

- [ ] **Step 1: Install Oxlint at the workspace root**

Run:

```powershell
npm.cmd install -D oxlint@1.72.0
```

Expected:

```text
package.json and package-lock.json change.
No app source files change.
```

- [ ] **Step 2: Add the root script**

In `package.json`, add:

```json
{
  "scripts": {
    "lint:oxlint": "turbo run lint:oxlint"
  }
}
```

Keep the existing `lint`, `verify`, and deploy scripts unchanged in this step.

- [ ] **Step 3: Add the preflight script**

In `apps/preflight/package.json`, add:

```json
{
  "scripts": {
    "lint:oxlint": "oxlint . --vitest-plugin --deny-warnings"
  }
}
```

Do not replace the existing `lint` script yet.

- [ ] **Step 4: Add the Oxlint config**

Create `apps/preflight/.oxlintrc.json`:

```json
{
  "$schema": "../../node_modules/oxlint/configuration_schema.json",
  "categories": {
    "correctness": "error",
    "suspicious": "warn",
    "perf": "warn",
    "pedantic": "off",
    "style": "off",
    "restriction": "off",
    "nursery": "off"
  },
  "ignorePatterns": [
    ".svelte-kit/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    "src/cloudflare-env.d.ts"
  ],
  "overrides": [
    {
      "files": ["scripts/**"],
      "rules": {
        "no-console": "off"
      }
    }
  ]
}
```

- [ ] **Step 5: Run Oxlint directly**

Run:

```powershell
npm.cmd run lint:oxlint -w preflight
```

Expected:

```text
Exit code 0.
No warnings, because --deny-warnings makes warnings fail the command.
```

If it reports issues, fix only toolchain-safe lint findings. Do not modify product behavior as part of this task.

- [ ] **Step 6: Promote Oxlint into preflight verify only after clean baseline**

In `apps/preflight/package.json`, change `verify` from:

```json
"verify": "npm run sync:gate-remote && npm run check && npm run lint && npm run test && npm run build"
```

to:

```json
"verify": "npm run sync:gate-remote && npm run check && npm run lint && npm run lint:oxlint && npm run test && npm run build"
```

Do this only after Step 5 passes.

- [ ] **Step 7: Run the full DeployLint verify**

Run:

```powershell
npm.cmd run verify:preflight
```

Expected:

```text
sync:gate-remote passes.
svelte-check passes.
prettier --check . passes.
eslint . passes.
oxlint . --vitest-plugin --deny-warnings passes.
vitest run passes.
vite build and scripts/export-durable-objects.mjs pass.
```

- [ ] **Step 8: Commit**

Run:

```powershell
git add package.json package-lock.json apps/preflight/package.json apps/preflight/.oxlintrc.json
git commit -m "chore(preflight): add oxlint supplemental lint gate"
```

## Task 2: Evaluate Biome Without Taking Over Formatting

**Files:**

- Optional modify: `package.json`
- Optional modify: `apps/preflight/package.json`
- Optional create: `biome.json`

- [ ] **Step 1: Create an isolated evaluation branch**

Run:

```powershell
git switch -c codex/deploylint-biome-eval
```

- [ ] **Step 2: Install Biome pinned exactly**

Run:

```powershell
npm.cmd install -D -E @biomejs/biome@2.5.2
```

Expected:

```text
package.json and package-lock.json change.
No app source files change.
```

- [ ] **Step 3: Add a linter-only Biome config**

Create `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.2/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "includes": [
      "apps/preflight/**",
      "!apps/preflight/.svelte-kit",
      "!apps/preflight/build",
      "!apps/preflight/dist",
      "!apps/preflight/test-results",
      "!apps/preflight/playwright-report",
      "!apps/preflight/blob-report",
      "!apps/preflight/src/cloudflare-env.d.ts"
    ]
  },
  "formatter": {
    "enabled": false
  },
  "assist": {
    "enabled": false
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

- [ ] **Step 4: Add an evaluation script only**

In `apps/preflight/package.json`, add:

```json
{
  "scripts": {
    "lint:biome": "biome ci --config-path ../../biome.json ."
  }
}
```

- [ ] **Step 5: Run Biome as an informational check**

Run:

```powershell
npm.cmd run lint:biome -w preflight
```

Expected:

```text
Command completes or reports actionable diagnostics.
No app files are auto-written.
```

- [ ] **Step 6: Compare coverage and noise against ESLint/Oxlint**

Run:

```powershell
npm.cmd run lint -w preflight
npm.cmd run lint:oxlint -w preflight
npm.cmd run lint:biome -w preflight
```

Accept Biome only if it finds distinct useful issues with low false positives. Reject it if it duplicates Oxlint/ESLint noise or rewrites Svelte markup in a way that creates churn.

- [ ] **Step 7: Keep Prettier as formatter unless a formatting diff is explicitly approved**

Do not change:

```json
"format": "prettier --write ."
```

Do not change:

```json
"lint": "prettier --check . && eslint ."
```

The current Prettier config includes Svelte and Tailwind plugins:

```json
{
  "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/routes/layout.css"
}
```

- [ ] **Step 8: Decide**

Promote Biome only if all of these are true:

```text
Biome adds non-duplicative diagnostics.
Biome does not fight Prettier's Svelte or Tailwind formatting.
Biome config is understandable and short.
Full npm.cmd run verify:preflight still passes.
```

Otherwise, close the branch and keep the source links in this plan for a later revisit.

## Task 3: Keep ESLint And Prettier Until Replacement Criteria Are Met

**Files:**

- Modify only after Task 1 and Task 2 acceptance: `apps/preflight/package.json`
- Modify only after Task 1 and Task 2 acceptance: `apps/preflight/eslint.config.js`
- Modify only after Task 1 and Task 2 acceptance: `apps/preflight/.prettierrc`

- [ ] **Step 1: Keep the current lint script during Oxlint rollout**

Keep:

```json
"lint": "prettier --check . && eslint ."
```

Rationale:

```text
ESLint covers Svelte-specific linting today.
Prettier covers Svelte formatting and Tailwind class sorting today.
Oxlint is additive and fast, but not a full Svelte template linter replacement.
Biome Svelte support should be treated as evaluation-grade until local diffs prove it is stable for this app.
```

- [ ] **Step 2: Remove ESLint only after this exact replacement proof exists**

Before deleting `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, `eslint-config-prettier`, or `globals`, prove:

```powershell
npm.cmd run check -w preflight
npm.cmd run lint:oxlint -w preflight
npm.cmd run lint:biome -w preflight
npm.cmd run test -w preflight
npm.cmd run build -w preflight
```

Expected:

```text
All commands pass.
No Svelte-template-only lint regression is identified in review.
At least one representative Svelte template issue is caught by the replacement stack or intentionally covered by svelte-check/tests.
```

- [ ] **Step 3: Remove Prettier only after this exact replacement proof exists**

Before deleting `prettier`, `prettier-plugin-svelte`, or `prettier-plugin-tailwindcss`, prove:

```powershell
npm.cmd run format -w preflight
git diff -- apps/preflight/src
```

Expected:

```text
The formatting diff is reviewed and accepted.
Tailwind classes remain sorted according to project expectations.
Svelte files remain stable and readable.
No large one-time formatting churn is mixed with behavior changes.
```

## Task 4: Keep Vitest Stable

**Files:**

- Usually no change.
- Optional later modify: `apps/preflight/package.json`
- Optional later modify: `package.json`

- [ ] **Step 1: Do not install Vitest beta**

Do not run:

```powershell
npm.cmd install -D vitest@beta
```

Rationale:

```text
The app already uses vitest@4.1.9, which is npm latest on 2026-07-05.
Vitest 5.0.0-beta.5 exists, but the official migration docs mark v5 migration as work in progress.
The current preflight tests are Node-environment unit tests; there is no test-runner feature gap that justifies beta risk.
```

- [ ] **Step 2: Keep the current test script**

Keep:

```json
"test": "vitest run"
```

- [ ] **Step 3: Revisit Vitest 5 only after stable release**

When Vitest 5 is stable, run:

```powershell
npm.cmd view vitest version dist-tags --json
npm.cmd run test -w preflight
npm.cmd run verify:preflight
```

Acceptance:

```text
latest is a stable v5 release, not beta.
Migration guide has stable v5 docs.
No mock-hoisting, fake-timer, snapshot, browser-mode, or coverage changes affect this app.
```

## Task 5: Upgrade Playwright Only To Stable

**Files:**

- Optional modify: `apps/preflight/package.json`
- Optional modify: `package.json` overrides only if the monorepo standardizes Playwright there later.

- [ ] **Step 1: Upgrade to latest stable, not prerelease**

Run later:

```powershell
npm.cmd install -D @playwright/test@1.61.1 -w preflight
npm.cmd run test:e2e:install -w preflight
```

Do not run:

```powershell
npm.cmd install -D @playwright/test@next -w preflight
npm.cmd install -D @playwright/test@beta -w preflight
```

Rationale:

```text
Playwright canary releases are published daily under next for unreleased features.
This app needs stable browser coverage, not canary feedback.
Playwright browser binaries track package versions, so every upgrade needs a browser install refresh.
```

- [ ] **Step 2: Run E2E verification**

Run:

```powershell
npm.cmd run test:e2e -w preflight
npm.cmd run verify:preflight
```

Expected:

```text
Chromium E2E passes against http://localhost:4199.
Full verify passes after browser binary refresh.
```

- [ ] **Step 3: Roll back if browser or E2E behavior changes**

Run:

```powershell
npm.cmd install -D @playwright/test@1.60.0 -w preflight
npm.cmd run test:e2e:install -w preflight
npm.cmd run verify:preflight
```

## Acceptance Criteria

- `npm.cmd run verify:preflight` passes after any accepted toolchain change.
- Oxlint is present as `npm.cmd run lint:oxlint -w preflight` and, after a clean baseline, is included in `verify`.
- Existing ESLint and Prettier checks remain in place unless replacement proof is documented in the implementing PR.
- No app source code is changed as part of the toolchain modernization.
- No prerelease Vitest or Playwright package is used in the default branch.
- Optional Biome evaluation is isolated, formatter-disabled by default, and either promoted with evidence or dropped.
- `git diff --check` passes.

## Rollback Criteria

- Revert Oxlint if it blocks `verify` with false positives that require product-code churn unrelated to actual defects.
- Revert Biome if it produces high-noise diagnostics, conflicts with Svelte/Prettier formatting, or requires a large formatting diff.
- Revert Playwright stable upgrade if browser installation, E2E startup, or Chromium behavior becomes flaky.
- Do not attempt to "fix forward" by installing prerelease Vitest or Playwright unless a specific upstream bug fix is cited and the change is isolated to a short-lived branch.

## Final Verification Commands

Run before merging any implementation of this plan:

```powershell
npm.cmd run lint:oxlint -w preflight
npm.cmd run lint -w preflight
npm.cmd run test -w preflight
npm.cmd run build -w preflight
npm.cmd run verify:preflight
git diff --check
```

If Playwright is touched, also run:

```powershell
npm.cmd run test:e2e:install -w preflight
npm.cmd run test:e2e -w preflight
```
