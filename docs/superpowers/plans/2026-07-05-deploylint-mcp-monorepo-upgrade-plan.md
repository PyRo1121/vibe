# Deploylint MCP Monorepo Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Deploylint MCP dependency hygiene to the current supported MCP TypeScript SDK line, keep package management boring, and clean shared package boundaries without changing app behavior.

**Architecture:** Keep the existing local stdio MCP server on the supported v1 SDK line now. Keep npm and Turbo for this repo size, then move reusable Deploylint contracts from `apps/` to `packages/` so apps and MCP consume a library instead of an app-shaped workspace.

**Tech Stack:** Node 26 locally, npm workspaces, npm lockfile v3, Turbo 2.10.3, TypeScript 6, Vitest, `@modelcontextprotocol/sdk` v1.29.0.

---

## Current State

- Root package manager: `packageManager: "npm@11.18.0"` in `package.json`.
- Local npm CLI: `npm.cmd --version` reported `11.17.0`; use `npm.cmd` in PowerShell because `npm.ps1` can be blocked by policy.
- Node: `v26.4.0`, satisfying the repo `engines.node >=22` and SDK v1 `node >=18`.
- Workspaces: root `package.json` includes only `apps/*`.
- Task runner: Turbo 2.10.3 with simple package-script orchestration in `turbo.json`.
- MCP package: `apps/preflight-mcp/package.json` depends on `@modelcontextprotocol/sdk: "^1.12.1"`.
- Lockfile reality: `package-lock.json` already resolves `node_modules/@modelcontextprotocol/sdk` to `1.29.0`, so the first upgrade is manifest alignment, not a risky runtime jump.
- Shared package: `apps/deploylint-shared` is a private workspace with handwritten `index.js` and `index.d.ts`, consumed through `file:../deploylint-shared`.
- Docs and product plans already point toward local npm stdio MCP first, then remote MCP after schemas/tools stabilize.

## Source Notes

- npm registry reports `@modelcontextprotocol/sdk` latest as `1.29.0` and node engine `>=18`: https://www.npmjs.com/package/%40modelcontextprotocol/sdk
- The MCP TypeScript SDK repository says v1.x remains the supported production release until the 2026-07-28 spec release; v2 is beta on the main branch: https://github.com/modelcontextprotocol/typescript-sdk
- The MCP TypeScript SDK v2 release notes say v2 splits packages into `@modelcontextprotocol/server` and `@modelcontextprotocol/client`, adds `serveStdio()`, and provides a beta codemod: https://github.com/modelcontextprotocol/typescript-sdk/releases
- npm workspaces auto-link local packages declared by root `workspaces`: https://docs.npmjs.com/cli/v8/using-npm/workspaces/
- pnpm workspaces require `pnpm-workspace.yaml` and support `workspace:` to force local package resolution: https://pnpm.io/workspaces
- Bun workspaces support `workspace:*`, filters, catalogs, and fast installs, but Bun is not installed locally in this repo: https://bun.com/docs/pm/workspaces
- Turborepo recommends `apps/` for applications/services and `packages/` for libraries/tooling: https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository
- Nx and Turbo both cover task scheduling, caching, and affected detection; Nx adds more advanced lifecycle features as needs grow: https://nx.dev/docs/guides/adopting-nx/nx-vs-turborepo

## Recommendation

1. Upgrade MCP SDK manifest to current v1 now: change `@modelcontextprotocol/sdk` from `^1.12.1` to `^1.29.0` in `apps/preflight-mcp/package.json`.
2. Do not migrate to MCP SDK v2 yet. It is beta as of 2026-07-05 and tied to a future spec date, while v1 is still the production-supported line.
3. Keep npm. The repo already has npm workspaces, a committed `package-lock.json`, and npm-specific scripts. A package-manager migration would churn the whole repo for little immediate value.
4. Keep Turbo. The repo has a small JavaScript/TypeScript workspace set and simple package-script orchestration. Nx is useful later if you need dependency boundary enforcement, generated project metadata, distributed CI, or more polyglot orchestration.
5. Move reusable Deploylint contracts from `apps/deploylint-shared` to `packages/deploylint-shared`, add a real TypeScript build, and widen root workspaces to `["apps/*", "packages/*"]`.
6. Keep shared package dependencies as `file:` paths while staying on npm. If the repo later moves to pnpm or Bun, switch those internal references to `workspace:*`.

## Task 1: Align MCP SDK Manifest With Current v1

**Files:**

- Modify: `apps/preflight-mcp/package.json`
- Update: `package-lock.json`

- [ ] **Step 1: Change the SDK dependency**

In `apps/preflight-mcp/package.json`, change only this dependency line:

```json
"@modelcontextprotocol/sdk": "^1.29.0"
```

Leave `zod` at `^4.4.3`; SDK v1.29.0 supports Zod 4.

- [ ] **Step 2: Refresh npm lock metadata**

Run:

```powershell
npm.cmd install
```

Expected:

```text
up to date
```

or a lockfile-only metadata update. `package-lock.json` should continue resolving `@modelcontextprotocol/sdk` to `1.29.0`.

- [ ] **Step 3: Verify the resolved SDK**

Run:

```powershell
npm.cmd ls @modelcontextprotocol/sdk -w preflight-mcp
```

Expected:

```text
preflight-mcp@0.3.0
`-- @modelcontextprotocol/sdk@1.29.0
```

- [ ] **Step 4: Run MCP verification**

Run:

```powershell
npm.cmd run verify:mcp
```

Expected: TypeScript check, Vitest tests, and MCP build pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/preflight-mcp/package.json package-lock.json
git commit -m "chore: align deploylint mcp sdk version"
```

## Task 2: Keep npm, Add Only Missing Ergonomic Scripts

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Keep package manager unchanged**

Do not change this field:

```json
"packageManager": "npm@11.18.0"
```

Do not add `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `bun.lock`, or `bunfig.toml` in this phase.

- [ ] **Step 2: Normalize MCP root scripts**

Keep the existing `verify:mcp`, and add only these root scripts if they are useful to later workers:

```json
"build:mcp": "turbo run build --filter=preflight-mcp",
"dev:mcp": "npm run dev -w preflight-mcp"
```

Rationale: `dev:mcp` should stay direct because MCP stdio dev mode is a single long-running process; `build:mcp` benefits from Turbo's package filtering.

- [ ] **Step 3: Verify scripts**

Run:

```powershell
npm.cmd run build:mcp
npm.cmd run verify:mcp
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json
git commit -m "chore: add mcp workspace scripts"
```

## Task 3: Keep Turbo, Avoid Nx Migration

**Files:**

- Modify: `turbo.json`

- [ ] **Step 1: Keep `turbo.json` structurally unchanged**

No Nx files should be added. Do not add `nx.json`, `project.json`, or `@nx/*` packages.

- [ ] **Step 2: Tighten package dependency ordering only if shared package gets a build**

After Task 4 adds `packages/deploylint-shared`, keep this existing build dependency:

```json
"build": {
  "dependsOn": ["^build"],
  "outputs": [".svelte-kit/**", "build/**", "dist/**"]
}
```

No change is required because `dependsOn: ["^build"]` already makes dependent packages build first when the dependency graph is visible to the package manager.

- [ ] **Step 3: Verify Turbo sees the packages**

Run:

```powershell
npm.cmd exec turbo run build --filter=preflight-mcp --dry=json
```

Expected: dry-run JSON includes `preflight-mcp#build` and, after Task 4, `@vibe/deploylint-shared#build` as a dependency when shared has a build script.

## Task 4: Move Shared Contracts To `packages/`

**Files:**

- Move: `apps/deploylint-shared` -> `packages/deploylint-shared`
- Modify: `package.json`
- Modify: `apps/preflight/package.json`
- Modify: `apps/preflight-mcp/package.json`
- Create: `packages/deploylint-shared/src/index.ts`
- Create: `packages/deploylint-shared/tsconfig.json`
- Modify: `packages/deploylint-shared/package.json`
- Update: `package-lock.json`

- [ ] **Step 1: Widen root workspaces**

In root `package.json`, change:

```json
"workspaces": [
  "apps/*"
]
```

to:

```json
"workspaces": [
  "apps/*",
  "packages/*"
]
```

- [ ] **Step 2: Move the shared package**

Move the directory:

```powershell
New-Item -ItemType Directory -Force packages
Move-Item apps/deploylint-shared packages/deploylint-shared
```

- [ ] **Step 3: Replace handwritten shared JS/types with one TypeScript source**

Create `packages/deploylint-shared/src/index.ts` with the current exported constants and interfaces from `apps/deploylint-shared/index.js` and `apps/deploylint-shared/index.d.ts`.

Use this runtime-compatible top block:

```ts
export const DEPLOYLINT_HOST = "deploylint.com";
export const DEPLOYLINT_WWW_HOST = "www.deploylint.com";
export const DEPLOYLINT_LEGACY_HOST = "lint.latham.cloud";
export const DEFAULT_DEPLOYLINT_API = `https://${DEPLOYLINT_HOST}`;
```

Then copy the existing exported types from `index.d.ts` into the same file as normal TypeScript exports.

- [ ] **Step 4: Add shared package TypeScript config**

Create `packages/deploylint-shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Update shared package manifest**

Replace `packages/deploylint-shared/package.json` with:

```json
{
  "name": "@vibe/deploylint-shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "check": "tsc --noEmit -p tsconfig.json",
    "verify": "npm run check && npm run build"
  },
  "devDependencies": {
    "typescript": "^6.0.3"
  }
}
```

- [ ] **Step 6: Update npm `file:` consumers**

In `apps/preflight/package.json` and `apps/preflight-mcp/package.json`, change:

```json
"@vibe/deploylint-shared": "file:../deploylint-shared"
```

to:

```json
"@vibe/deploylint-shared": "file:../../packages/deploylint-shared"
```

Do not use `workspace:*` while the repo remains npm-based.

- [ ] **Step 7: Reinstall and build shared**

Run:

```powershell
npm.cmd install
npm.cmd run build -w @vibe/deploylint-shared
```

Expected: `packages/deploylint-shared/dist/index.js` and `packages/deploylint-shared/dist/index.d.ts` are generated.

- [ ] **Step 8: Verify dependents**

Run:

```powershell
npm.cmd run verify:mcp
npm.cmd run verify:preflight
```

Expected: MCP and Preflight both compile against the generated shared package.

- [ ] **Step 9: Commit**

```powershell
git add package.json package-lock.json apps/preflight/package.json apps/preflight-mcp/package.json packages/deploylint-shared
git rm -r apps/deploylint-shared
git commit -m "chore: move deploylint shared types to packages"
```

## Task 5: Document The Tooling Decision

**Files:**

- Modify: `README.md`
- Modify: `docs/tech-stack.md`
- Modify: `skills/deploylint/SKILL.md`

- [ ] **Step 1: Update root README workspace commands**

Keep the `apps/preflight-mcp` path in the app table until the MCP package is renamed or published. Add these command references:

```markdown
| Deploylint MCP | `apps/preflight-mcp` | `npm run dev:mcp` |
```

and:

```markdown
Use `npm.cmd` on Windows PowerShell when script execution policy blocks `npm.ps1`.
```

- [ ] **Step 2: Update `docs/tech-stack.md`**

Add this short decision record:

```markdown
## Monorepo Tooling

- Package manager: npm workspaces with `package-lock.json`.
- Task runner: Turbo.
- Shared libraries live in `packages/*`; deployable apps and services live in `apps/*`.
- Keep internal package references as `file:` while using npm.
- Revisit pnpm only if install speed, strict workspace linking, or cataloged dependency versions become a real maintenance problem.
- Revisit Nx only if dependency-boundary enforcement, generators, distributed CI, or polyglot orchestration become necessary.
```

- [ ] **Step 3: Update Deploylint skill command path**

In `skills/deploylint/SKILL.md`, keep the local dev command aligned with the root script:

```json
"args": ["run", "dev:mcp"]
```

for an npm-launched config, or keep the existing direct `tsx apps/preflight-mcp/src/index.ts` command if the skill intentionally bypasses package scripts. Do not mix both in the same snippet.

- [ ] **Step 4: Verify docs references**

Run:

```powershell
rg -n "apps/deploylint-shared|npm run dev -w preflight-mcp|@modelcontextprotocol/sdk.*1\\.12\\.1|workspace:\\*" README.md docs skills apps/preflight-mcp apps/preflight
```

Expected: no stale shared-package path, old MCP dev command, old SDK version, or `workspace:*` references for npm mode.

## Deferred: MCP SDK v2 Migration

Do not execute this before the v2 SDK is stable and the MCP spec release lands.

When v2 is stable:

1. Replace `@modelcontextprotocol/sdk` with `@modelcontextprotocol/server`.
2. Use the official codemod first:

```powershell
npm.cmd exec @modelcontextprotocol/codemod@latest -- v1-to-v2 apps/preflight-mcp
```

3. Expect import and startup changes because v2 split packages and introduced `serveStdio()`.
4. Re-run all MCP tests and add an MCP smoke test that starts the stdio server and performs an initialize/tools-list round trip.
5. Keep v1 until the v2 migration has a clean rollback path and no client compatibility issue.

## Package Manager Decision Matrix

| Option | Recommendation   | Why                                                                                                                                                                         |
| ------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm    | Use now          | Already configured, committed lockfile, works with current scripts, lowest churn.                                                                                           |
| pnpm   | Revisit later    | Better strict local linking through `workspace:*` and better disk/install behavior, but requires `pnpm-workspace.yaml`, a lockfile migration, and dependency-resolution QA. |
| Bun    | Do not adopt now | Fast and supports workspaces/catalogs, but Bun is not installed locally and Cloudflare/SvelteKit/npm-script compatibility is unnecessary risk for this phase.               |

## Turbo vs Nx Decision Matrix

| Option | Recommendation | Why                                                                                                                                                       |
| ------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turbo  | Keep now       | Existing config is small, enough for TypeScript/Svelte packages, and already handles package script orchestration.                                        |
| Nx     | Revisit later  | Worth it if the repo needs enforced dependency boundaries, generators, affected project intelligence in CI, distributed caching, or non-JS orchestration. |

## Acceptance Criteria

- `apps/preflight-mcp/package.json` declares `@modelcontextprotocol/sdk: "^1.29.0"`.
- `npm.cmd ls @modelcontextprotocol/sdk -w preflight-mcp` shows exactly `@modelcontextprotocol/sdk@1.29.0`.
- `npm.cmd run verify:mcp` passes.
- Root package manager remains npm; no pnpm or Bun lockfiles are added.
- Turbo remains the monorepo task runner; no Nx config or dependencies are added.
- Shared Deploylint contracts live under `packages/deploylint-shared` and build to `dist`.
- Root workspaces include both `apps/*` and `packages/*`.
- Internal shared package consumers use npm-compatible `file:../../packages/deploylint-shared`.
- `npm.cmd run verify:preflight` passes after the shared-package move.
- Docs no longer reference `apps/deploylint-shared`, SDK `1.12.1`, or stale MCP commands.

## Rollback Criteria

Rollback immediately if any of these happen:

- MCP server tests or build fail after SDK manifest alignment.
- `npm.cmd install` creates unexpected dependency churn outside SDK/shared-package metadata.
- Moving shared contracts breaks SvelteKit/Cloudflare builds or introduces runtime import failures.
- Turbo no longer orders shared package builds before MCP/preflight builds.
- Docs or scripts require pnpm/Bun/Nx despite the repo staying on npm/Turbo.

Rollback commands:

```powershell
git revert <commit-that-aligned-sdk>
git revert <commit-that-added-mcp-scripts>
git revert <commit-that-moved-shared-package>
npm.cmd install
npm.cmd run verify:mcp
npm.cmd run verify:preflight
```

If rollback is needed before commits exist, restore these files from the pre-change diff instead of using `git checkout --` against unrelated user work:

```text
package.json
package-lock.json
apps/preflight/package.json
apps/preflight-mcp/package.json
apps/deploylint-shared/**
packages/deploylint-shared/**
```

## Final Verification Bundle

Run this bundle before marking the modernization complete:

```powershell
git status --short
npm.cmd install
npm.cmd ls @modelcontextprotocol/sdk -w preflight-mcp
npm.cmd run build -w @vibe/deploylint-shared
npm.cmd run verify:mcp
npm.cmd run verify:preflight
npm.cmd run verify
rg -n "apps/deploylint-shared|@modelcontextprotocol/sdk.*1\\.12\\.1|workspace:\\*" README.md docs skills apps/preflight-mcp apps/preflight
git status --short
```

Expected final state: only intentional modernization files are changed, all verification commands pass, and no stale MCP/shared-package references remain.
