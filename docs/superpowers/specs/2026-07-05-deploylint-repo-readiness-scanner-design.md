# Deploylint Repo Readiness Scanner Design

Status: approved direction, design ready for review
Date: 2026-07-05
Owner: Deploylint

## Goal

Make Deploylint feel like a real pre-push and repo launch-readiness scanner before investing in more SEO, GitHub Action packaging, MCP distribution, or paid checkout.

The first implementation phase stays static-only. Deploylint will inspect public repository files and configuration, but it will not install dependencies, execute scripts, run builds, or evaluate untrusted code. This keeps the Cloudflare-hosted scanner cheap, fast, deterministic, and safer while still catching the mistakes a solo builder is most likely to ship.

## Product Promise

When a user pastes a public GitHub repo, Deploylint should answer:

- Would this repo likely fail before push or deploy?
- Are the lint, test, typecheck, and build commands discoverable?
- Is the package manager setup reproducible?
- Are CI workflows present and reasonably safe?
- Are dependency, secret, and license risks visible before launch?
- What should the developer fix first?

## Current Baseline

Already implemented in `apps/preflight/src/lib/scan/repo`:

- Public GitHub repo parsing and fetching.
- Committed `.env` detection.
- Secret pattern sampling in source files.
- `.gitignore` coverage for env files.
- OSV vulnerability checks from lockfile packages.
- Direct and transitive dependency license screening.
- Repo license and sell-rights checks.
- README presence and quality.
- CI presence.
- Test presence.
- Lockfile presence.
- Node version pin detection.
- TypeScript `strict` detection.
- Monorepo package manifest and package-lock sampling.

The next phase should deepen this existing flow instead of replacing it.

## Non-Goals

- No arbitrary command execution.
- No dependency installation.
- No local CLI yet.
- No MCP or GitHub Action expansion yet.
- No private repo support in this phase.
- No SARIF output until repo findings include stable file evidence.
- No dashboard or saved project model changes.

## Recommended Architecture

Add a new static analyzer layer under:

```text
apps/preflight/src/lib/scan/repo/readiness.ts
apps/preflight/src/lib/scan/repo/readiness.test.ts
```

`readiness.ts` should expose pure helpers that accept repository tree entries and selected file texts, then return normalized findings. `scan.ts` remains the orchestrator that fetches files, calls analyzers, converts findings into `ScanCheck[]`, and builds the existing `ScanReport`.

Keep network-dependent work in existing modules:

- GitHub file/tree fetching stays in `github.ts`.
- NPM license lookups stay in `audit.ts`.
- OSV calls stay in `osv.ts`.
- Lockfile parsing stays in `lockfile.ts`.

The new readiness layer should be boring, pure, and heavily unit-tested.

## Data Model

Introduce a small internal finding shape:

```ts
export interface RepoReadinessFinding {
  id: string;
  category: ScanCheck['category'];
  title: string;
  status: ScanCheck['status'];
  message: string;
  evidence?: {
    path?: string;
    snippet?: string;
  };
}
```

The implementation can keep this type internal at first. It becomes valuable later for GitHub annotations and JSON/SARIF output.

## Phase 1 Check Families

### Package Scripts

Detect whether root and sampled app package manifests define useful scripts:

- `lint`
- `test`
- `check`
- `typecheck`
- `build`
- Svelte-specific `check` or `svelte-check`

Rules:

- Pass when a useful script exists.
- Warn when expected scripts are missing.
- Warn when scripts are placeholders like `echo "no tests"`, `exit 0`, or `true`.
- Warn when scripts exist only in nested apps but root scripts do not expose a monorepo command.

Output should tell the user the exact script to add or expose.

### Lint And Formatter Setup

Detect configuration for:

- ESLint.
- Biome.
- Prettier.
- Svelte ESLint or Svelte check where SvelteKit is detected.

Rules:

- Pass when a supported linter is configured and a script invokes it.
- Warn when config exists but no script runs it.
- Warn when a lint script exists but no config or dependency is visible.
- Warn on huge ignore patterns that hide the app source, such as ignoring `src/**` or `apps/**`.

Do not fail on missing formatting. Formatting is product polish, not a launch blocker.

### TypeScript And Framework Checks

Extend the current TypeScript strict check:

- Detect `tsconfig.json` and common nested app tsconfigs.
- Detect `strict: false`.
- Detect missing `noEmit` for typecheck-only TS projects when applicable.
- Detect `skipLibCheck` as informational only, not a warning by itself.
- Detect SvelteKit projects and recommend `svelte-check` when absent.

Rules:

- Strict disabled is a warning.
- Missing typecheck script in a TypeScript repo is a warning.
- Invalid JSON config is a warning with file evidence.

### Package Manager Hygiene

Extend lockfile and version pin checks:

- Detect mixed root lockfiles.
- Detect `packageManager` field in `package.json`.
- Detect package manager mismatch between `packageManager` and committed lockfile.
- Keep current Node pin detection.

Rules:

- Mixed lockfiles are a warning.
- Missing `packageManager` is a warning for JavaScript repos.
- Mismatch is a warning.
- Missing lockfile remains a warning.

### CI Workflow Quality

Extend CI presence into actual workflow quality:

- Parse GitHub workflow YAML enough to detect job steps and `run` commands with a tolerant text scan.
- Detect whether CI runs lint, test, typecheck/check, and build.
- Detect `permissions: write-all`.
- Detect `pull_request_target`.
- Detect unpinned third-party actions using floating versions like `@main` or `@master`.
- Detect checkout/install/build pattern basics.

Rules:

- Missing CI remains a warning.
- CI without lint/test/build/check is a warning.
- `permissions: write-all` is a warning.
- `pull_request_target` with script execution is a fail if evidence is clear; otherwise warn.
- First-party actions such as `actions/checkout@v4` are acceptable as major-version pins.
- Third-party actions should avoid floating branch refs.

Keep workflow parsing conservative. Prefer fewer high-confidence findings over noisy YAML opinions.

### Deploy And Runtime Config

Detect common deploy targets:

- `wrangler.jsonc`, `wrangler.toml`.
- `vercel.json`.
- `netlify.toml`.
- `Dockerfile`.
- `docker-compose.yml`.

Rules:

- Warn when a framework app is present but no deploy/runtime config is visible and CI is absent.
- Warn when Cloudflare Worker config has stale `compatibility_date` by more than 180 days.
- Warn when Dockerfile copies `.env` or uses obviously unsafe secret patterns.

Do not require every project to have deploy config. This is a confidence signal, not a blocker.

## Integration Into Reports

`scan.ts` should keep building one `ScanReport` with normal `ScanCheck` entries. New readiness checks should appear in existing categories:

- `security` for secrets, workflow permission risk, unsafe Docker env handling.
- `launch` for scripts, CI, typecheck, package manager hygiene, deploy config.
- `legal` for license work that already exists.

The UI can initially render these as normal checks. A later report UX pass can group them into "Before push", "Before deploy", and "Before selling".

## Fix Prompts

Each new check needs a targeted `fixPrompt` entry in `apps/preflight/src/lib/scan/prompts.ts`.

Prompt style:

- Name the detected file.
- Explain the minimal fix.
- Avoid telling the agent to rewrite unrelated config.
- Include copyable examples only when safe and generic.

Examples:

- Missing lint script: add a `lint` script that runs the configured linter.
- Mixed lockfiles: choose one package manager and remove the others.
- CI missing build: add `npm run build` after install and checks.
- Workflow write-all: replace with the smallest needed permissions.

## Testing Strategy

Add tests before implementation:

- Pure unit tests for `readiness.ts`.
- Orchestrator tests in `scan.test.ts` for representative repo fixtures.
- Prompt tests for every new check ID.
- Verdict tests only if a new check becomes P0.

Fixture coverage:

- Healthy SvelteKit repo with lint, check, test, build, CI, packageManager, lockfile.
- Minimal JavaScript repo with no scripts.
- Monorepo with nested app scripts but missing root scripts.
- Workflow with broad permissions.
- Workflow using `pull_request_target`.
- Mixed lockfile repo.
- Cloudflare Worker with stale compatibility date.

## Rollout Order

1. Package script analyzer.
2. Lint/formatter analyzer.
3. Package manager hygiene analyzer.
4. TypeScript/Svelte analyzer.
5. CI workflow quality analyzer.
6. Deploy/runtime config analyzer.
7. Fix prompt pass.
8. Report copy pass for repo scan summary.

This order gives developers the most immediate pre-push value first.

## Acceptance Criteria

- Full `npm.cmd run verify:preflight` passes.
- New repo-readiness helpers are pure and unit-tested.
- Existing healthy repo scan tests still pass.
- A healthy SvelteKit fixture receives pass statuses for scripts, lint, typecheck, package manager, CI, and deploy config.
- A minimal repo receives actionable warnings instead of vague warnings.
- No new check executes code or downloads arbitrary dependencies.
- No high-noise check is marked as `fail` unless evidence is clear and launch-impacting.
- Report output remains compatible with existing web UI, gate script, MCP, and badges.

## Open Decisions

1. Whether missing `test` should stay warning-only forever or become fail in CI gate mode.
2. Whether workflow broad permissions should be P1 warning or P0 fail.
3. Whether to add YAML parsing dependency later or keep tolerant text scanning for GitHub workflows.

Recommendation:

- Keep all three as conservative warnings in the first implementation.
- Revisit severity after dogfooding Deploylint against this monorepo and a few representative public repos.
