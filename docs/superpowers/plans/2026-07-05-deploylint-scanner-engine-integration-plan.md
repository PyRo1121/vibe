# Deploylint Scanner Engine Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate or emulate OSV Scanner, zizmor, Trivy, Semgrep, OpenSSF Scorecard, SBOM/CycloneDX/SPDX, and SARIF export as low-noise Deploylint launch-readiness signals.

**Architecture:** Keep Deploylint as the product layer and treat scanner engines as optional evidence providers. Static, pure analyzers run first inside the existing Cloudflare-safe repo scanner; heavier CLI engines run later through a queued sandbox/worker path and map into Deploylint-owned check IDs instead of dumping raw scanner output into the UI.

**Tech Stack:** SvelteKit, Cloudflare Workers, TypeScript, Vitest, GitHub REST/raw fetches, OSV.dev API, optional external CLI adapters, SARIF 2.1.0, CycloneDX, SPDX.

---

## Assumptions

- Public GitHub repo scanning remains the first supported input.
- No arbitrary command execution, dependency installation, or untrusted repo code execution in the Worker-hosted scanner.
- This plan covers scanner engines only; app UI, billing, monitoring, and dashboard changes are out of scope except where they consume normalized findings later.
- The implementation must preserve current `ScanReport` compatibility until a versioned richer finding payload is introduced.

## Current Baseline

Existing scanner files:

- `apps/preflight/src/lib/scan/repo/scan.ts`: orchestrates GitHub fetches, lockfile parsing, OSV calls, readiness analyzers, `ScanCheck[]`, `RepoInfo`, and `ScanReport`.
- `apps/preflight/src/lib/scan/repo/readiness.ts`: pure static analyzers for package scripts, lint/format setup, package manager hygiene, TypeScript/Svelte checks, GitHub Actions quality, and deploy config.
- `apps/preflight/src/lib/scan/repo/osv.ts`: OSV.dev `querybatch` integration over npm lockfile packages, plus best-effort severity detail lookups.
- `apps/preflight/src/lib/scan/repo/lockfile.ts`: npm `package-lock.json` parser and curated transitive license screening.
- `apps/preflight/src/lib/scan/repo/audit.ts`: dotenv detection, source sampling, package manifest parsing, npm license lookup.
- `apps/preflight/src/lib/scan/repo/github.ts`: GitHub API/raw fetch layer.
- `apps/deploylint-shared/index.d.ts`: public report model currently exposes `ScanCheck` without file/line/source-engine metadata.

Current repo check IDs already implemented:

- `env-committed`
- `secrets`
- `gitignore-env`
- `dependency-vulns`
- `repo-license`
- `license-risk`
- `readme`
- `ci-config`
- `tests-present`
- `lockfile-committed`
- `node-version-pinned`
- `ts-strict`
- `package-scripts`
- `lint-script`
- `format-script`
- `typecheck-script`
- `build-script`
- `svelte-check`
- `package-manager-pinned`
- `mixed-lockfiles`
- `ci-runs-quality-gates`
- `workflow-permissions`
- `workflow-pull-request-target`
- `workflow-action-pinning`
- `deploy-config`
- `wrangler-compat-date`
- `docker-env-copy`

## Current Gaps

- OSV coverage is npm `package-lock.json` only. It misses pnpm, Yarn, Bun, Go, Python, Rust, Java, Ruby, Docker images, and SBOM inputs that OSV Scanner or Trivy would detect.
- `dependency-vulns` has no fixed version, advisory URL list, direct/transitive classification, dev/prod dependency context, reachability context, or dedupe key beyond message text.
- GitHub Actions security is hand-rolled. It catches broad permissions, risky `pull_request_target`, and floating third-party refs, but does not cover the broader zizmor rule set.
- Semgrep-style SAST is absent. Deploylint currently samples secrets and static config, but does not look for framework/security code patterns such as unsafe CORS, missing webhook verification, weak auth guards, or dangerous server-side fetch patterns.
- Trivy-style filesystem/IaC/secret/container scanning is absent. Deploylint has some Dockerfile and dotenv checks, but no IaC misconfiguration adapter, no container dependency scan, and no filesystem vulnerability scan.
- Scorecard-style project security posture is absent or partial. Deploylint has CI and permissions heuristics, but not branch protection, maintainers, security policy, signed releases, token permissions at Scorecard depth, fuzzing, code review, or dependency update posture.
- SBOM readiness is only implied by lockfile parsing. Deploylint does not detect existing SBOMs, validate CycloneDX/SPDX shape, identify SBOM generation scripts, or export an SBOM.
- SARIF export is blocked by the public `ScanCheck` model. It lacks source engine, stable rule metadata, file path, line/column, help URI, fingerprint, and result level mapping.
- No scanner provenance exists. A user cannot tell whether a finding came from Deploylint static emulation, OSV API, OSV Scanner, zizmor, Trivy, Semgrep, or Scorecard.
- No noise budget exists. Future engines could flood reports unless every external finding is mapped, grouped, capped, and launch-prioritized.

## Product Rule

Deploylint should not become scanner glue. The report should say:

- what blocks launch,
- what to fix next,
- what can wait,
- what evidence supports the recommendation.

External scanners are allowed to increase confidence, evidence, and coverage. They are not allowed to define the user-facing report shape.

## Internal Finding Model

Add a richer internal finding type before adding CLI engines. Keep conversion to current `ScanCheck` at the report boundary.

Create: `apps/preflight/src/lib/scan/repo/findings.ts`

```ts
import type { ScanCheck } from "$lib/scan/types";

export type RepoFindingEngine =
  | "deploylint-static"
  | "osv-api"
  | "osv-scanner"
  | "zizmor"
  | "trivy"
  | "semgrep"
  | "scorecard"
  | "sbom"
  | "sarif-export";

export type RepoFindingConfidence = "high" | "medium" | "low";
export type RepoFindingLaunchImpact = "blocker" | "fix-soon" | "watch";

export interface RepoFindingLocation {
  path: string;
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  snippet?: string;
}

export interface RepoFindingReference {
  label: string;
  url: string;
}

export interface RepoFindingFix {
  summary: string;
  promptId: string;
  fixedVersion?: string;
}

export interface RepoEngineFinding {
  id: string;
  ruleId: string;
  title: string;
  category: ScanCheck["category"];
  status: ScanCheck["status"];
  launchImpact: RepoFindingLaunchImpact;
  confidence: RepoFindingConfidence;
  message: string;
  engine: RepoFindingEngine;
  engineRuleId?: string;
  locations: RepoFindingLocation[];
  references: RepoFindingReference[];
  fix: RepoFindingFix;
  fingerprint: string;
  rawSeverity?:
    "critical" | "high" | "medium" | "moderate" | "low" | "info" | "unknown";
}

export interface RepoEngineFindingBatch {
  engine: RepoFindingEngine;
  version?: string;
  source: "static-emulation" | "api" | "cli-json" | "cli-sarif" | "cli-sbom";
  findings: RepoEngineFinding[];
  warnings: string[];
}
```

Mapping rules:

- `id`: Deploylint check instance ID. Stable across rescans when path/package/vulnerability is the same.
- `ruleId`: Deploylint-owned check ID. This is the user-facing policy.
- `engineRuleId`: external scanner rule/advisory ID such as `GHSA-x`, `zizmor.unpinned-uses`, `semgrep.javascript.express.security.*`, or a Scorecard check name.
- `fingerprint`: deterministic hash of `ruleId`, `engine`, package or path, primary advisory/rule, and location.
- `launchImpact`: Deploylint priority queue, not raw CVSS or scanner severity.
- `confidence`: controls whether a finding can fail the report. Low confidence findings should be capped and usually render as `watch`.

## Noise Controls

- Only Deploylint-owned `ruleId` values render in the main report.
- External findings are grouped by launch risk and fix action.
- The main report shows at most 12 repo-engine findings: all blockers, then the highest-confidence fix-soon items, then omit watch-only items from the top queue.
- A raw-engine detail view can be added later, but the default report stays a short fix list.
- `fail` requires high-confidence evidence and clear launch impact.
- `warn` is the default for posture, hygiene, unknown severity, or missing best-practice checks.
- `pass` should only be emitted for checks Deploylint can actually verify from available evidence.
- Unreachable external engines produce scanner coverage warnings, not fake passes or fails.

## Exact Check IDs To Add

Add these Deploylint-owned check IDs before or during engine integration.

### OSV Scanner / SCA

- `osv-lockfile-coverage`: warn when unsupported or unparsed lockfiles exist; pass when supported lockfiles/SBOM inputs are covered.
- `osv-fixed-version`: warn/fail vulnerability findings without known fixed version only when severity is high/critical; pass when high/critical findings include fix guidance.
- `dependency-vuln-production-impact`: fail for high/critical prod/runtime dependency CVEs; warn for dev-only or unknown scope.
- `dependency-vuln-advisory-links`: pass when vulnerability findings include OSV/GHSA/CVE references; warn when references are missing.
- `dependency-vuln-dedupe`: internal/reporting check used in tests to ensure one user-facing finding per package/advisory/fix action.

Keep existing:

- `dependency-vulns`
- `lockfile-committed`
- `mixed-lockfiles`
- `package-manager-pinned`

### zizmor / GitHub Actions

- `workflow-zizmor-critical`: fail when zizmor or static emulation finds high-confidence credential exposure, script injection, or untrusted checkout with privileged token.
- `workflow-untrusted-checkout`: fail when `pull_request_target` checks out untrusted head code and runs scripts with write/secrets context.
- `workflow-script-injection`: fail when untrusted GitHub context is interpolated directly in shell.
- `workflow-persist-credentials`: warn when checkout credentials remain available without need.
- `workflow-codeowners`: warn when workflow files are not covered by CODEOWNERS when CODEOWNERS exists.
- `workflow-dependabot-actions`: warn when Dependabot does not update GitHub Actions.
- `workflow-action-sha-pinning`: warn for third-party actions not pinned to SHA in strict mode; keep `workflow-action-pinning` as the default non-strict branch-ref check.

Keep existing:

- `workflow-permissions`
- `workflow-pull-request-target`
- `workflow-action-pinning`
- `ci-runs-quality-gates`

### Trivy / Filesystem, IaC, Secrets, Containers

- `trivy-fs-vulns`: warn/fail grouped filesystem dependency vulnerabilities from Trivy when OSV Scanner does not cover the ecosystem.
- `trivy-iac-critical`: fail for high-confidence IaC/deploy misconfigurations that expose secrets, public storage, privileged containers, or broad cloud permissions.
- `trivy-secret-confirmed`: fail only for confirmed high-signal secrets not already covered by `secrets` or `env-committed`.
- `container-base-image-vulns`: warn/fail for high/critical runtime image vulnerabilities when a Dockerfile/image scan is available.
- `dockerfile-root-user`: warn when Dockerfile runs app as root and exposes network service.
- `dockerfile-unpinned-base`: warn when Dockerfile base image uses `latest` or an unpinned moving tag.

Keep existing:

- `docker-env-copy`
- `deploy-config`

### Semgrep / SAST

- `sast-high-confidence`: fail only for high-confidence exploitable app-security patterns with file evidence.
- `cors-wildcard-credentials`: fail when code clearly combines wildcard CORS with credentials or sensitive routes.
- `webhook-signature-missing`: fail/warn when Stripe/Paddle/Lemon Squeezy webhook handlers are detected without signature verification.
- `admin-route-unprotected`: fail only when an obvious admin route lacks an auth guard in a supported framework pattern.
- `server-ssrf-risk`: warn/fail when user-controlled URLs flow into server-side fetch without the existing public URL guard pattern.
- `sql-raw-user-input`: fail for direct user input in raw SQL strings in supported libraries.
- `dangerous-eval`: warn/fail for user-controlled `eval`, `Function`, or shell execution in app code.

### OpenSSF Scorecard / Project Posture

- `scorecard-enabled`: pass when Scorecard action/config is present; warn when absent for public OSS-style repos.
- `branch-protection-visible`: warn when branch protection cannot be confirmed; pass only when GitHub API evidence is available.
- `security-policy`: warn when `SECURITY.md` or GitHub security policy is absent.
- `dependabot-config`: warn when `.github/dependabot.yml` is absent for supported ecosystems.
- `dependency-review-action`: warn when PR workflows do not run GitHub dependency review for npm/GitHub repos.
- `code-scanning-config`: warn when no CodeQL, Semgrep, Scorecard, or SARIF upload path is visible.
- `signed-release-posture`: watch-only warning when release workflows publish packages/images without provenance/signing hints.

### SBOM / CycloneDX / SPDX

- `sbom-present`: pass when CycloneDX/SPDX SBOM file is present and parseable; warn when missing for release-producing repos.
- `sbom-generation-script`: pass when package scripts or CI generate CycloneDX/SPDX; warn when release workflow exists but no SBOM generation is visible.
- `sbom-format-valid`: warn when an SBOM file is present but invalid or unsupported.
- `sbom-release-attached`: warn when release workflows publish artifacts but do not attach or upload SBOMs.
- `sbom-provenance-gap`: watch-only warning when release workflow claims provenance/attestation but no SBOM/provenance artifact is visible.

### SARIF Export

- `sarif-export-ready`: pass when all non-pass repo findings have rule ID, level, message, fingerprint, and location or repo-level fallback.
- `sarif-location-coverage`: warn when more than 20 percent of non-pass repo findings lack file paths.
- `sarif-github-compatible`: test-only/reporting check that validates generated SARIF against GitHub-required shape.

## Engine Strategy

### OSV Scanner

Near term:

- Keep current OSV.dev API path for Worker-safe npm lockfile checks.
- Extend parsers for `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, and common ecosystem manifests only if parsing is deterministic and cheap.
- Normalize OSV findings into `RepoEngineFinding`.

Later:

- Run `osv-scanner scan --format=json` in an external sandbox for broader ecosystem support.
- Use OSV Scanner SARIF only as import evidence, not as Deploylint's SARIF export source of truth.
- Use OSV Scanner CycloneDX/SPDX output only if Deploylint needs an SBOM and no native generator is available.

### zizmor

Near term:

- Expand static GitHub Actions emulation in `readiness.ts` for the highest-signal checks listed above.
- Keep tolerant text scanning unless a YAML parser is introduced deliberately.

Later:

- Run zizmor in a sandbox against workflow files.
- Map zizmor findings into Deploylint workflow check IDs.
- Render only critical/high-confidence workflow launch risks in the main queue.

### Trivy

Near term:

- Emulate selected Dockerfile and deploy-config checks statically.
- Detect Trivy config and existing Trivy CI usage.

Later:

- Run `trivy fs --format json` or SARIF in a sandbox for ecosystems not covered by OSV API.
- Run Trivy SBOM generation with `--format cyclonedx` or SPDX where supported.
- Do not surface every Trivy vulnerability separately; group by package/fix action and launch impact.

### Semgrep

Near term:

- Add Deploylint-owned static checks for a narrow AI-app launch risk pack: webhook signature verification, unsafe CORS, public admin surfaces, SSRF guard absence, raw SQL input, and dangerous eval.
- Use framework-specific high-confidence patterns only.

Later:

- Run Semgrep with a curated local rule pack, not `--config auto`, to avoid noisy generic findings.
- Import Semgrep JSON/SARIF into `RepoEngineFinding`.
- Gate fail status to high-confidence rules only.

### OpenSSF Scorecard

Near term:

- Emulate visible Scorecard-adjacent posture: `SECURITY.md`, Dependabot, CodeQL/Semgrep/SARIF upload, Scorecard action, dependency review action, workflow permissions, branch protection unknown.

Later:

- Run Scorecard when token/API permissions are available.
- Treat Scorecard numeric score as detail only. Do not map "score below X" directly to a fail.

### SBOM / CycloneDX / SPDX

Near term:

- Detect existing SBOM files by path and parse minimum format markers:
  - CycloneDX JSON: `bomFormat: "CycloneDX"` and `specVersion`.
  - SPDX JSON/tag-value: `spdxVersion`, `SPDXID`, or SPDX document markers.
- Detect generation scripts and CI steps containing `cyclonedx`, `spdx`, `sbom`, `osv-scanner --format=cyclonedx`, or `trivy ... --format cyclonedx`.

Later:

- Generate SBOMs in sandbox through Trivy, OSV Scanner, or ecosystem-native CycloneDX tools.
- Attach SBOM summary to report metadata and SARIF properties, not the core UI.

### SARIF Export

Near term:

- Build Deploylint SARIF from `RepoEngineFinding`, not from raw external SARIF.
- Include one SARIF `run` with Deploylint as the tool and external engine metadata in result properties.

Later:

- Add GitHub upload workflow/action docs.
- Add API endpoint or CLI command to fetch SARIF for a repo scan.

## Implementation Phases

### Phase 1: Finding Model And Adapter Boundary

**Files:**

- Create: `apps/preflight/src/lib/scan/repo/findings.ts`
- Create: `apps/preflight/src/lib/scan/repo/findings.test.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.ts`
- Modify: `apps/preflight/src/lib/scan/prompts.ts`

- [ ] Add `RepoEngineFinding`, `RepoEngineFindingBatch`, and helpers to convert old `RepoReadinessFinding` into the richer model.
- [ ] Add deterministic fingerprint helper with test vectors for package, workflow, and file-location findings.
- [ ] Keep `ScanCheck` conversion in `scan.ts` so UI/gate/MCP stay compatible.
- [ ] Add tests proving duplicate findings choose highest launch impact and highest confidence.
- [ ] Add prompt entries for all Phase 1 check IDs.
- [ ] Run: `npm.cmd run test -w preflight -- src/lib/scan/repo/findings.test.ts src/lib/scan/repo/readiness.test.ts src/lib/scan/repo/scan.test.ts`
- [ ] Expected: all targeted Vitest files pass.

### Phase 2: Static Emulation Pack

**Files:**

- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.test.ts`
- Modify: `apps/preflight/src/lib/scan/prompts.ts`

- [ ] Add static checks for `dependabot-config`, `dependency-review-action`, `security-policy`, `scorecard-enabled`, and `code-scanning-config`.
- [ ] Add static workflow checks for `workflow-untrusted-checkout`, `workflow-script-injection`, `workflow-persist-credentials`, `workflow-codeowners`, and `workflow-dependabot-actions`.
- [ ] Add Dockerfile checks for `dockerfile-root-user` and `dockerfile-unpinned-base`.
- [ ] Add SBOM detection checks for `sbom-present`, `sbom-generation-script`, and `sbom-format-valid`.
- [ ] Add tests with healthy and risky fixtures for each new check ID.
- [ ] Run: `npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts src/lib/scan/repo/scan.test.ts`
- [ ] Expected: risky fixtures warn/fail only where evidence is explicit; healthy fixture remains `go`.

### Phase 3: OSV Coverage Upgrade

**Files:**

- Modify: `apps/preflight/src/lib/scan/repo/lockfile.ts`
- Modify: `apps/preflight/src/lib/scan/repo/lockfile.test.ts`
- Modify: `apps/preflight/src/lib/scan/repo/osv.ts`
- Modify: `apps/preflight/src/lib/scan/repo/osv.test.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.test.ts`
- Modify: `apps/preflight/src/lib/scan/prompts.ts`

- [ ] Extend lockfile parsing only for formats that can be tested without installing dependencies.
- [ ] Add fixed-version and advisory-reference extraction where OSV detail data provides it.
- [ ] Add check IDs `osv-lockfile-coverage`, `osv-fixed-version`, `dependency-vuln-production-impact`, and `dependency-vuln-advisory-links`.
- [ ] Group vulnerabilities by package/advisory/fix action before converting to `ScanCheck`.
- [ ] Add tests for high/critical prod dependency, dev-only dependency, unknown severity, missing fixed version, and OSV unreachable.
- [ ] Run: `npm.cmd run test -w preflight -- src/lib/scan/repo/lockfile.test.ts src/lib/scan/repo/osv.test.ts src/lib/scan/repo/scan.test.ts`
- [ ] Expected: OSV outage still skips vulnerability checks instead of faking results.

### Phase 4: SARIF Export

**Files:**

- Create: `apps/preflight/src/lib/scan/repo/sarif.ts`
- Create: `apps/preflight/src/lib/scan/repo/sarif.test.ts`
- Modify: `apps/preflight/src/lib/scan/repo/findings.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.ts`

- [ ] Generate SARIF 2.1.0 with `version`, `$schema`, `runs`, `tool.driver.rules`, and `results`.
- [ ] Map `fail` to SARIF `error`, `warn` to `warning`, and watch-only info to `note`.
- [ ] Use `locations[0].physicalLocation.artifactLocation.uri` for file findings.
- [ ] Use a repo-level fallback artifact URI such as `README.md` only when no better location exists, and track this through `sarif-location-coverage`.
- [ ] Add `partialFingerprints.deploylintFingerprint`.
- [ ] Include external engine metadata in `result.properties.deploylint`.
- [ ] Add tests for GitHub-compatible minimum shape, rule dedupe, path normalization, and stable fingerprints.
- [ ] Run: `npm.cmd run test -w preflight -- src/lib/scan/repo/sarif.test.ts src/lib/scan/repo/findings.test.ts`
- [ ] Expected: generated SARIF can be parsed as JSON and contains stable rules/results for known fixtures.

### Phase 5: External Engine Sandbox Adapters

**Files:**

- Create: `apps/preflight/src/lib/scan/repo/engines/osv-scanner.ts`
- Create: `apps/preflight/src/lib/scan/repo/engines/zizmor.ts`
- Create: `apps/preflight/src/lib/scan/repo/engines/trivy.ts`
- Create: `apps/preflight/src/lib/scan/repo/engines/semgrep.ts`
- Create: `apps/preflight/src/lib/scan/repo/engines/scorecard.ts`
- Create: `apps/preflight/src/lib/scan/repo/engines/*.test.ts`

- [ ] Define adapters that accept parsed JSON/SARIF fixtures and return `RepoEngineFindingBatch`.
- [ ] Do not shell out from the Worker scanner.
- [ ] Add CLI execution only in a separate queued sandbox worker or future CLI package.
- [ ] For each adapter, add golden fixture tests with real-looking but minimal scanner output.
- [ ] Add version and warning propagation for scanner failures.
- [ ] Run: `npm.cmd run test -w preflight -- src/lib/scan/repo/engines`
- [ ] Expected: adapters are pure, deterministic, and can be tested without binaries installed.

### Phase 6: Full Verification

**Files:**

- Modify only files touched in prior phases.

- [ ] Run: `npm.cmd run verify:preflight`
- [ ] Expected: sync, check, lint, tests, and build pass.
- [ ] Run: `npm.cmd run gate:preflight`
- [ ] Expected: gate output remains compatible with existing `ScanCheck` shape.
- [ ] Run: `npm.cmd run verify:mcp`
- [ ] Expected: MCP formatting still handles repo scans without requiring new model fields.

## Acceptance Criteria

- Deploylint report remains a short ordered launch-readiness queue, not a raw scanner dump.
- Every new user-facing scanner result has a Deploylint-owned stable `ruleId`.
- Every non-pass scanner finding has `engine`, `confidence`, `launchImpact`, `fingerprint`, `message`, and fix prompt ID.
- External engines can be unavailable without making the scan fail.
- No Worker-hosted path installs dependencies, executes repo code, shells out, or runs untrusted scanner binaries.
- OSV findings remain available through the current OSV.dev API path even before OSV Scanner CLI support exists.
- zizmor, Trivy, Semgrep, and Scorecard adapters are pure parsers/mappers until a sandbox execution path is implemented.
- High-noise findings are grouped or hidden from the main queue unless they are high-confidence launch blockers.
- SBOM checks recognize CycloneDX and SPDX artifacts and generation steps before trying to generate SBOMs.
- SARIF export is generated from normalized Deploylint findings, not raw external SARIF.
- `npm.cmd run verify:preflight` passes before the scanner integration is considered complete.

## Test Commands

Use `npm.cmd` on this Windows checkout.

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
npm.cmd run test -w preflight -- src/lib/scan/repo/scan.test.ts
npm.cmd run test -w preflight -- src/lib/scan/repo/osv.test.ts
npm.cmd run test -w preflight -- src/lib/scan/repo/lockfile.test.ts
npm.cmd run test -w preflight -- src/lib/scan/repo/findings.test.ts
npm.cmd run test -w preflight -- src/lib/scan/repo/sarif.test.ts
npm.cmd run verify:preflight
npm.cmd run verify:mcp
```

## Source Links

- OSV Scanner output formats: https://google.github.io/osv-scanner/output/
- OSV Scanner usage: https://google.github.io/osv-scanner/usage/
- OSV Scanner repository: https://github.com/google/osv-scanner
- zizmor documentation: https://docs.zizmor.sh/
- zizmor repository: https://github.com/zizmorcore/zizmor
- Trivy reporting formats: https://trivy.dev/docs/latest/configuration/reporting/
- Trivy SBOM documentation: https://trivy.dev/docs/latest/supply-chain/sbom/
- Semgrep JSON and SARIF fields: https://docs.semgrep.dev/semgrep-appsec-platform/json-and-sarif
- Semgrep documentation: https://docs.semgrep.dev/
- OpenSSF Scorecard: https://scorecard.dev/
- OpenSSF Scorecard checks: https://github.com/ossf/scorecard/blob/main/docs/checks.md
- OpenSSF Scorecard GitHub Action: https://github.com/ossf/scorecard-action
- CycloneDX specification overview: https://cyclonedx.org/specification/overview/
- SPDX specifications: https://spdx.dev/use/specifications/
- OASIS SARIF technical committee: https://www.oasis-open.org/committees/tc_home.php?wg_abbrev=sarif
- GitHub SARIF support for code scanning: https://docs.github.com/en/code-security/reference/code-scanning/sarif-files/sarif-support
- GitHub Actions security hardening: https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions
- GitHub dependency review: https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review
