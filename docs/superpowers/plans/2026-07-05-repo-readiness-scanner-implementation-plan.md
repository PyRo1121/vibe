# Repo Readiness Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Deploylint's public GitHub repo scanner into a static pre-push readiness engine that checks scripts, linting, typechecking, package-manager hygiene, CI workflow quality, and deploy/runtime config without executing untrusted code.

**Architecture:** Add a pure `repo/readiness.ts` analyzer layer that converts fetched repository tree/file evidence into normalized findings. Keep `scan.ts` as the orchestrator that fetches GitHub files, calls static analyzers, converts findings into `ScanCheck[]`, and preserves the existing `ScanReport` shape used by the web UI, gate, MCP, badges, and reports.

**Tech Stack:** SvelteKit app, TypeScript, Vitest, GitHub tree/file API fetchers, existing Deploylint `ScanCheck` and `ScanReport` types, static text/JSON analysis only.

---

## Research Synthesis

Bleeding-edge direction, kept practical for Deploylint:

- **OpenSSF Scorecard:** Use clear security-health heuristics, but avoid treating any aggregate score as truth. Deploylint should show individual, actionable findings with evidence.
- **zizmor and 2026 GitHub Actions research:** Workflow security is high-value. Prioritize permissions, `pull_request_target`, unpinned/floating actions, and script-injection risk from untrusted GitHub contexts.
- **GitHub Actions secure-use docs:** Recommend minimum `GITHUB_TOKEN` permissions and treat untrusted PR/issue fields in inline shell as injection surfaces.
- **OSV Scanner and SBOM research:** Lockfiles are the most reliable static source for dependency posture, but vulnerability output must stay low-noise and severity-aware.
- **Trivy:** The broad scanner market has converged on repo/filesystem + vuln + secret + license + misconfiguration coverage. Deploylint should not run a full Trivy clone yet; it should capture the high-signal launch/readiness subset.
- **ESLint 9/10 docs:** Flat config is the modern config surface. Detect `eslint.config.*` first, while still recognizing legacy `.eslintrc*`.
- **Biome v2:** Biome is now a serious formatter/linter option. Treat `biome.json` or `biome.jsonc` plus a script as first-class lint/format readiness.
- **Corepack/packageManager:** Modern Node repos should pin a package manager through `packageManager` or compatible `devEngines.packageManager`, and lockfile choice should match the pinned manager.
- **SLSA/OWASP CI/CD risks:** Readiness should look for reproducible, hosted CI builds, least privilege, artifact integrity signals, and obvious pipeline abuse patterns, but keep severe failures reserved for clear evidence.

Primary sources:

- https://github.com/ossf/scorecard
- https://github.com/zizmorcore/zizmor
- https://google.github.io/osv-scanner/
- https://trivy.dev/docs/latest/guide/
- https://docs.github.com/en/actions/reference/security/secure-use
- https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning
- https://eslint.org/docs/latest/use/configure/configuration-files
- https://biomejs.dev/blog/biome-v2/
- https://github.com/nodejs/corepack#readme
- https://slsa.dev/spec/v1.2/
- https://owasp.org/www-project-top-10-ci-cd-security-risks/

## File Structure

- Create `apps/preflight/src/lib/scan/repo/readiness.ts`
  - Owns pure static repo readiness analysis.
  - Exports `RepoReadinessFinding`, `PackageManifestEvidence`, `analyzePackageScripts`, `analyzeLintSetup`, `analyzePackageManager`, `analyzeTypescriptSetup`, `analyzeCiWorkflows`, and `analyzeDeployConfig`.
- Create `apps/preflight/src/lib/scan/repo/readiness.test.ts`
  - Unit tests for each pure analyzer.
- Modify `apps/preflight/src/lib/scan/repo/scan.ts`
  - Fetch additional file texts needed for CI/config checks.
  - Call readiness analyzers.
  - Convert findings into `ScanCheck[]`.
  - Include evidence paths in `repo.filesSampled`.
- Modify `apps/preflight/src/lib/scan/repo/scan.test.ts`
  - Add orchestration tests for a healthy SvelteKit repo, a minimal JS repo, mixed lockfiles, risky workflows, and stale Cloudflare config.
- Modify `apps/preflight/src/lib/scan/prompts.ts`
  - Add fix prompts for new check IDs.
- Modify `apps/preflight/src/lib/scan/prompts.test.ts`
  - Assert new check IDs produce specific prompts and do not fall through to the generic fallback.

## Check IDs

Use these IDs exactly:

- `package-scripts`
- `lint-script`
- `format-script`
- `typecheck-script`
- `build-script`
- `package-manager-pinned`
- `mixed-lockfiles`
- `ci-runs-quality-gates`
- `workflow-permissions`
- `workflow-pull-request-target`
- `workflow-action-pinning`
- `svelte-check`
- `deploy-config`
- `wrangler-compat-date`
- `docker-env-copy`

All new IDs start as warning/pass checks except:

- `workflow-pull-request-target` may fail only when a workflow contains `pull_request_target` and clear inline script execution that references untrusted PR/issue context.
- `docker-env-copy` may fail only when a Dockerfile clearly copies `.env` into the image.

## Task 1: Pure Analyzer Skeleton And Types

**Files:**
- Create: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Create: `apps/preflight/src/lib/scan/repo/readiness.test.ts`

- [ ] **Step 1: Write the failing type/skeleton tests**

Add this to `apps/preflight/src/lib/scan/repo/readiness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	analyzePackageScripts,
	type PackageManifestEvidence,
	type RepoReadinessFinding
} from './readiness';

const rootManifest: PackageManifestEvidence = {
	path: 'package.json',
	json: {
		scripts: {
			lint: 'eslint .',
			test: 'vitest run',
			check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
			build: 'vite build'
		},
		devDependencies: {
			eslint: '^9.0.0',
			'svelte-check': '^4.0.0'
		}
	}
};

describe('repo readiness analyzer', () => {
	it('returns normalized findings for package script readiness', () => {
		const findings: RepoReadinessFinding[] = analyzePackageScripts([rootManifest]);

		expect(findings.map((finding) => finding.id)).toContain('package-scripts');
		expect(findings.find((finding) => finding.id === 'package-scripts')).toMatchObject({
			category: 'launch',
			title: 'Package scripts',
			status: 'pass'
		});
	});
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: fail because `readiness.ts` does not exist.

- [ ] **Step 3: Add minimal analyzer skeleton**

Create `apps/preflight/src/lib/scan/repo/readiness.ts`:

```ts
import type { ScanCheck } from '$lib/scan/types';

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

export interface PackageManifestEvidence {
	path: string;
	json: {
		scripts?: Record<string, string>;
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		engines?: { node?: string };
		packageManager?: string;
		devEngines?: {
			packageManager?:
				| string
				| {
						name?: string;
						version?: string;
						onFail?: string;
				  };
		};
	};
}

function finding(
	id: string,
	title: string,
	status: ScanCheck['status'],
	message: string,
	evidence?: RepoReadinessFinding['evidence']
): RepoReadinessFinding {
	return { id, category: 'launch', title, status, message, evidence };
}

export function analyzePackageScripts(
	manifests: PackageManifestEvidence[]
): RepoReadinessFinding[] {
	const root = manifests.find((manifest) => manifest.path === 'package.json') ?? manifests[0];
	const scripts = root?.json.scripts ?? {};
	const expected = ['lint', 'test', 'build'];
	const missing = expected.filter((name) => !scripts[name]?.trim());

	return [
		finding(
			'package-scripts',
			'Package scripts',
			missing.length === 0 ? 'pass' : 'warn',
			missing.length === 0
				? `Root package.json exposes lint, test, and build scripts.`
				: `Root package.json is missing ${missing.join(', ')} script${missing.length === 1 ? '' : 's'}.`,
			root ? { path: root.path } : undefined
		)
	];
}
```

- [ ] **Step 4: Run the test**

Run:

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts
git commit -m "Add repo readiness analyzer skeleton"
```

## Task 2: Package Scripts And Tooling Scripts

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`

- [ ] **Step 1: Add failing tests for scripts**

Append these tests inside the existing `describe` block:

```ts
it('warns on missing root lint, test, and build scripts', () => {
	const findings = analyzePackageScripts([
		{
			path: 'package.json',
			json: { scripts: { dev: 'vite dev' } }
		}
	]);

	expect(findings.find((finding) => finding.id === 'package-scripts')).toMatchObject({
		status: 'warn',
		message: 'Root package.json is missing lint, test, build scripts.'
	});
	expect(findings.find((finding) => finding.id === 'lint-script')).toMatchObject({
		status: 'warn'
	});
	expect(findings.find((finding) => finding.id === 'build-script')).toMatchObject({
		status: 'warn'
	});
});

it('treats placeholder scripts as warnings', () => {
	const findings = analyzePackageScripts([
		{
			path: 'package.json',
			json: {
				scripts: {
					lint: 'eslint .',
					test: 'echo "no tests" && exit 0',
					build: 'true'
				}
			}
		}
	]);

	expect(findings.find((finding) => finding.id === 'package-scripts')?.message).toContain(
		'placeholder test, build scripts'
	);
	expect(findings.find((finding) => finding.id === 'build-script')).toMatchObject({
		status: 'warn',
		message: 'The build script in package.json is a placeholder.'
	});
});

it('warns when nested app scripts exist but root scripts do not expose them', () => {
	const findings = analyzePackageScripts([
		{ path: 'package.json', json: { scripts: { dev: 'turbo dev' } } },
		{
			path: 'apps/web/package.json',
			json: {
				scripts: {
					lint: 'eslint .',
					test: 'vitest run',
					build: 'vite build'
				}
			}
		}
	]);

	expect(findings.find((finding) => finding.id === 'package-scripts')?.message).toContain(
		'nested apps have scripts, but the root package.json does not expose lint, test, and build'
	);
});
```

- [ ] **Step 2: Run the failing tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: fail because `lint-script` and `build-script` findings are not implemented.

- [ ] **Step 3: Implement script helpers**

Replace `analyzePackageScripts` in `readiness.ts` and add these helpers above it:

```ts
const CORE_SCRIPT_NAMES = ['lint', 'test', 'build'] as const;
const CHECK_SCRIPT_NAMES = ['check', 'typecheck'] as const;

function scriptValue(manifest: PackageManifestEvidence | undefined, name: string): string | null {
	const value = manifest?.json.scripts?.[name]?.trim();
	return value ? value : null;
}

function isPlaceholderScript(script: string): boolean {
	return /(^|\s)(true|exit\s+0)\s*$/i.test(script) || /echo\s+['"]?no tests/i.test(script);
}

function hasUsefulScript(manifest: PackageManifestEvidence | undefined, name: string): boolean {
	const script = scriptValue(manifest, name);
	return Boolean(script && !isPlaceholderScript(script));
}

function hasAnyUsefulScript(
	manifest: PackageManifestEvidence | undefined,
	names: readonly string[]
): boolean {
	return names.some((name) => hasUsefulScript(manifest, name));
}

function scriptFinding(
	id: string,
	title: string,
	scriptName: string,
	root: PackageManifestEvidence | undefined
): RepoReadinessFinding {
	const script = scriptValue(root, scriptName);
	if (!script) {
		return finding(id, title, 'warn', `No ${scriptName} script found in root package.json.`, {
			path: root?.path
		});
	}
	if (isPlaceholderScript(script)) {
		return finding(id, title, 'warn', `The ${scriptName} script in package.json is a placeholder.`, {
			path: root?.path,
			snippet: script
		});
	}
	return finding(id, title, 'pass', `Root package.json defines "${scriptName}": ${script}.`, {
		path: root?.path,
		snippet: script
	});
}

export function analyzePackageScripts(
	manifests: PackageManifestEvidence[]
): RepoReadinessFinding[] {
	const root = manifests.find((manifest) => manifest.path === 'package.json') ?? manifests[0];
	const rootMissing = CORE_SCRIPT_NAMES.filter((name) => !hasUsefulScript(root, name));
	const placeholder = CORE_SCRIPT_NAMES.filter((name) => {
		const script = scriptValue(root, name);
		return Boolean(script && isPlaceholderScript(script));
	});
	const nestedHasCore = manifests
		.filter((manifest) => manifest.path !== root?.path)
		.some((manifest) => CORE_SCRIPT_NAMES.every((name) => hasUsefulScript(manifest, name)));

	const summary =
		rootMissing.length === 0
			? 'Root package.json exposes useful lint, test, and build scripts.'
			: nestedHasCore
				? 'Nested apps have scripts, but the root package.json does not expose lint, test, and build for pre-push checks.'
				: placeholder.length > 0
					? `Root package.json has placeholder ${placeholder.join(', ')} scripts.`
					: `Root package.json is missing ${rootMissing.join(', ')} script${rootMissing.length === 1 ? '' : 's'}.`;

	return [
		finding(
			'package-scripts',
			'Package scripts',
			rootMissing.length === 0 ? 'pass' : 'warn',
			summary,
			root ? { path: root.path } : undefined
		),
		scriptFinding('lint-script', 'Lint script', 'lint', root),
		scriptFinding('build-script', 'Build script', 'build', root),
		hasAnyUsefulScript(root, CHECK_SCRIPT_NAMES)
			? finding(
					'typecheck-script',
					'Typecheck script',
					'pass',
					'Root package.json exposes a check or typecheck script.',
					{ path: root?.path }
				)
			: finding(
					'typecheck-script',
					'Typecheck script',
					'warn',
					'No check or typecheck script found in root package.json.',
					{ path: root?.path }
				)
	];
}
```

- [ ] **Step 4: Run the tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts
git commit -m "Analyze package readiness scripts"
```

## Task 3: Lint, Formatter, TypeScript, And Svelte Checks

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`

- [ ] **Step 1: Add failing tests**

Add imports:

```ts
import {
	analyzeLintSetup,
	analyzeTypescriptSetup,
	type RepoFileEvidence
} from './readiness';
```

If this duplicates the existing import, merge the symbols into the existing import.

Add these tests:

```ts
it('passes modern ESLint flat config and Prettier when scripts invoke them', () => {
	const files: RepoFileEvidence[] = [
		{ path: 'eslint.config.js', text: 'export default [];' },
		{ path: '.prettierrc', text: '{}' }
	];
	const findings = analyzeLintSetup([rootManifest], files);

	expect(findings.find((finding) => finding.id === 'lint-script')).toMatchObject({
		status: 'pass'
	});
	expect(findings.find((finding) => finding.id === 'format-script')).toMatchObject({
		status: 'warn',
		message: 'Prettier config exists, but root package.json has no format script.'
	});
});

it('treats Biome as first-class lint and format tooling', () => {
	const findings = analyzeLintSetup(
		[
			{
				path: 'package.json',
				json: {
					scripts: { lint: 'biome check .', format: 'biome format --write .' },
					devDependencies: { '@biomejs/biome': '^2.0.0' }
				}
			}
		],
		[{ path: 'biome.json', text: '{}' }]
	);

	expect(findings.find((finding) => finding.id === 'lint-script')).toMatchObject({
		status: 'pass'
	});
	expect(findings.find((finding) => finding.id === 'format-script')).toMatchObject({
		status: 'pass'
	});
});

it('detects SvelteKit projects missing svelte-check', () => {
	const findings = analyzeTypescriptSetup(
		[
			{
				path: 'package.json',
				json: {
					scripts: { build: 'vite build' },
					devDependencies: { '@sveltejs/kit': '^2.0.0', typescript: '^5.0.0' }
				}
			}
		],
		[{ path: 'tsconfig.json', text: JSON.stringify({ compilerOptions: { strict: true } }) }]
	);

	expect(findings.find((finding) => finding.id === 'svelte-check')).toMatchObject({
		status: 'warn'
	});
	expect(findings.find((finding) => finding.id === 'typecheck-script')).toMatchObject({
		status: 'warn'
	});
});
```

- [ ] **Step 2: Run the failing tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: fail because the analyzers are missing.

- [ ] **Step 3: Implement file evidence and analyzers**

Add this to `readiness.ts` after `PackageManifestEvidence`:

```ts
export interface RepoFileEvidence {
	path: string;
	text: string | null;
}

function rootManifest(manifests: PackageManifestEvidence[]): PackageManifestEvidence | undefined {
	return manifests.find((manifest) => manifest.path === 'package.json') ?? manifests[0];
}

function hasDependency(manifest: PackageManifestEvidence | undefined, names: string[]): boolean {
	const deps = {
		...(manifest?.json.dependencies ?? {}),
		...(manifest?.json.devDependencies ?? {})
	};
	return names.some((name) => deps[name] != null);
}

function hasFile(files: RepoFileEvidence[], patterns: RegExp[]): RepoFileEvidence | undefined {
	return files.find((file) => patterns.some((pattern) => pattern.test(file.path)));
}

function scriptIncludes(
	manifest: PackageManifestEvidence | undefined,
	scriptName: string,
	patterns: RegExp[]
): boolean {
	const script = scriptValue(manifest, scriptName);
	return Boolean(script && patterns.some((pattern) => pattern.test(script)));
}

export function analyzeLintSetup(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): RepoReadinessFinding[] {
	const root = rootManifest(manifests);
	const eslintConfig = hasFile(files, [
		/(^|\/)eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/,
		/(^|\/)\.eslintrc(\.(json|js|cjs|yml|yaml))?$/
	]);
	const biomeConfig = hasFile(files, [/(^|\/)biome\.jsonc?$/]);
	const prettierConfig = hasFile(files, [
		/(^|\/)\.prettierrc(\.(json|js|cjs|mjs|yml|yaml))?$/,
		/(^|\/)prettier\.config\.(js|cjs|mjs|ts)$/
	]);

	const lintConfigured =
		Boolean(eslintConfig || biomeConfig) || hasDependency(root, ['eslint', '@biomejs/biome']);
	const lintRuns =
		scriptIncludes(root, 'lint', [/\beslint\b/, /\bbiome\s+check\b/, /\bbiome\s+lint\b/]) ||
		scriptIncludes(root, 'check', [/\beslint\b/, /\bbiome\s+check\b/]);
	const formatRuns =
		scriptIncludes(root, 'format', [/\bprettier\b/, /\bbiome\s+format\b/, /\bbiome\s+check\b/]) ||
		scriptIncludes(root, 'lint', [/\bprettier\s+--check\b/]);

	return [
		finding(
			'lint-script',
			'Lint script',
			lintConfigured && lintRuns ? 'pass' : 'warn',
			lintConfigured && lintRuns
				? 'Lint tooling is configured and invoked by package scripts.'
				: lintConfigured
					? 'Lint config exists, but root package.json does not run it from lint or check.'
					: 'No ESLint or Biome configuration found for JavaScript/TypeScript linting.',
			{ path: eslintConfig?.path ?? biomeConfig?.path ?? root?.path }
		),
		finding(
			'format-script',
			'Format script',
			formatRuns ? 'pass' : 'warn',
			formatRuns
				? 'Formatting is available from package scripts.'
				: prettierConfig || biomeConfig
					? `${prettierConfig ? 'Prettier' : 'Biome'} config exists, but root package.json has no format script.`
					: 'No Prettier or Biome format script found.',
			{ path: prettierConfig?.path ?? biomeConfig?.path ?? root?.path }
		)
	];
}

export function analyzeTypescriptSetup(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): RepoReadinessFinding[] {
	const root = rootManifest(manifests);
	const tsconfig = hasFile(files, [/(^|\/)tsconfig\.json$/]);
	const hasTs = Boolean(tsconfig) || hasDependency(root, ['typescript']);
	const hasSvelteKit = hasDependency(root, ['@sveltejs/kit', 'svelte']);
	const typecheckRuns = Boolean(
		scriptIncludes(root, 'check', [/\bsvelte-check\b/, /\btsc\b/]) ||
			scriptIncludes(root, 'typecheck', [/\bsvelte-check\b/, /\btsc\b/])
	);
	const svelteCheckConfigured =
		hasDependency(root, ['svelte-check']) ||
		scriptIncludes(root, 'check', [/\bsvelte-check\b/]) ||
		scriptIncludes(root, 'typecheck', [/\bsvelte-check\b/]);

	const findings: RepoReadinessFinding[] = [];
	if (hasTs) {
		findings.push(
			finding(
				'typecheck-script',
				'Typecheck script',
				typecheckRuns ? 'pass' : 'warn',
				typecheckRuns
					? 'TypeScript or Svelte typechecking is exposed through package scripts.'
					: 'TypeScript is present, but root package.json has no check/typecheck script running tsc or svelte-check.',
				{ path: root?.path }
			)
		);
	}
	if (hasSvelteKit) {
		findings.push(
			finding(
				'svelte-check',
				'Svelte check',
				svelteCheckConfigured ? 'pass' : 'warn',
				svelteCheckConfigured
					? 'Svelte check is configured for Svelte/SvelteKit type safety.'
					: 'SvelteKit detected, but svelte-check is not visible in dependencies or package scripts.',
				{ path: root?.path }
			)
		);
	}
	return findings;
}
```

- [ ] **Step 4: Run the tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts
git commit -m "Analyze repo lint and typecheck readiness"
```

## Task 4: Package Manager And Lockfile Hygiene

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`

- [ ] **Step 1: Add failing tests**

Add import symbol `analyzePackageManager`.

Add tests:

```ts
it('passes when packageManager matches the committed lockfile', () => {
	const findings = analyzePackageManager(
		[
			{
				path: 'package.json',
				json: { packageManager: 'pnpm@10.0.0' }
			}
		],
		[{ path: 'pnpm-lock.yaml', text: 'lockfileVersion: 9.0' }]
	);

	expect(findings.find((finding) => finding.id === 'package-manager-pinned')).toMatchObject({
		status: 'pass'
	});
	expect(findings.find((finding) => finding.id === 'mixed-lockfiles')).toMatchObject({
		status: 'pass'
	});
});

it('warns on mixed lockfiles and packageManager mismatch', () => {
	const findings = analyzePackageManager(
		[
			{
				path: 'package.json',
				json: { packageManager: 'pnpm@10.0.0' }
			}
		],
		[
			{ path: 'package-lock.json', text: '{}' },
			{ path: 'yarn.lock', text: '' }
		]
	);

	expect(findings.find((finding) => finding.id === 'mixed-lockfiles')).toMatchObject({
		status: 'warn'
	});
	expect(findings.find((finding) => finding.id === 'package-manager-pinned')?.message).toContain(
		'packageManager says pnpm, but the root lockfile looks like npm'
	);
});
```

- [ ] **Step 2: Run the failing tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: fail because `analyzePackageManager` is missing.

- [ ] **Step 3: Implement package manager analysis**

Add to `readiness.ts`:

```ts
const LOCKFILE_MANAGERS: Record<string, string> = {
	'package-lock.json': 'npm',
	'npm-shrinkwrap.json': 'npm',
	'pnpm-lock.yaml': 'pnpm',
	'yarn.lock': 'yarn',
	'bun.lock': 'bun',
	'bun.lockb': 'bun'
};

function managerFromPackageManager(value: string | undefined): string | null {
	if (!value) return null;
	const match = value.match(/^([a-z0-9-]+)@/i);
	return match?.[1]?.toLowerCase() ?? null;
}

function rootLockfiles(files: RepoFileEvidence[]): RepoFileEvidence[] {
	return files.filter((file) => !file.path.includes('/') && LOCKFILE_MANAGERS[file.path]);
}

export function analyzePackageManager(
	manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[]
): RepoReadinessFinding[] {
	const root = rootManifest(manifests);
	const lockfiles = rootLockfiles(files);
	const manager = managerFromPackageManager(root?.json.packageManager);
	const firstLockManager = lockfiles[0] ? LOCKFILE_MANAGERS[lockfiles[0].path] : null;
	const hasMismatch = Boolean(manager && firstLockManager && manager !== firstLockManager);

	return [
		finding(
			'package-manager-pinned',
			'Package manager pinned',
			manager && !hasMismatch ? 'pass' : 'warn',
			!manager
				? 'Root package.json does not pin packageManager, so installs may use different npm/pnpm/yarn versions across machines.'
				: hasMismatch
					? `packageManager says ${manager}, but the root lockfile looks like ${firstLockManager}.`
					: `packageManager pins ${root?.json.packageManager}.`,
			{ path: root?.path }
		),
		finding(
			'mixed-lockfiles',
			'Mixed lockfiles',
			lockfiles.length <= 1 ? 'pass' : 'warn',
			lockfiles.length <= 1
				? lockfiles.length === 1
					? `One root lockfile found: ${lockfiles[0].path}.`
					: 'No mixed root lockfiles found.'
				: `Multiple root lockfiles found (${lockfiles.map((file) => file.path).join(', ')}). Pick one package manager before launch.`,
			lockfiles[0] ? { path: lockfiles[0].path } : undefined
		)
	];
}
```

- [ ] **Step 4: Run the tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts
git commit -m "Analyze package manager hygiene"
```

## Task 5: CI Workflow Quality And Security

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`

- [ ] **Step 1: Add failing tests**

Add import symbol `analyzeCiWorkflows`.

Add tests:

```ts
it('passes CI workflows that run quality gates with read-only permissions', () => {
	const findings = analyzeCiWorkflows([
		{
			path: '.github/workflows/ci.yml',
			text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build
`
		}
	]);

	expect(findings.find((finding) => finding.id === 'ci-runs-quality-gates')).toMatchObject({
		status: 'pass'
	});
	expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
		status: 'pass'
	});
	expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
		status: 'pass'
	});
});

it('warns on broad permissions and floating third-party action refs', () => {
	const findings = analyzeCiWorkflows([
		{
			path: '.github/workflows/ci.yml',
			text: `
on: [push]
permissions: write-all
jobs:
  test:
    steps:
      - uses: vendor/deploy@main
      - run: npm test
`
		}
	]);

	expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
		status: 'warn'
	});
	expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
		status: 'warn'
	});
});

it('fails pull_request_target workflows that run untrusted PR context in shell', () => {
	const findings = analyzeCiWorkflows([
		{
			path: '.github/workflows/review.yml',
			text: `
on: pull_request_target
jobs:
  review:
    steps:
      - run: echo "\${{ github.event.pull_request.title }}"
`
		}
	]);

	expect(findings.find((finding) => finding.id === 'workflow-pull-request-target')).toMatchObject({
		status: 'fail'
	});
});
```

- [ ] **Step 2: Run the failing tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: fail because `analyzeCiWorkflows` is missing.

- [ ] **Step 3: Implement CI analyzer**

Add to `readiness.ts`:

```ts
function workflowFiles(files: RepoFileEvidence[]): RepoFileEvidence[] {
	return files.filter((file) => /^\.github\/workflows\/[^/]+\.(ya?ml)$/.test(file.path));
}

function workflowHas(text: string, pattern: RegExp): boolean {
	return pattern.test(text);
}

function floatingThirdPartyActions(text: string): string[] {
	const refs = [...text.matchAll(/\buses:\s*([^\s#]+)@([^\s#]+)/gi)].map((match) => ({
		action: match[1],
		ref: match[2]
	}));
	return refs
		.filter(({ action, ref }) => !action.startsWith('actions/') && /^(main|master|latest|HEAD)$/i.test(ref))
		.map(({ action, ref }) => `${action}@${ref}`);
}

export function analyzeCiWorkflows(files: RepoFileEvidence[]): RepoReadinessFinding[] {
	const workflows = workflowFiles(files);
	if (workflows.length === 0) {
		return [
			finding(
				'ci-runs-quality-gates',
				'CI runs quality gates',
				'warn',
				'No GitHub Actions workflow found under .github/workflows.'
			)
		];
	}

	const combined = workflows.map((file) => file.text ?? '').join('\n');
	const hasLint = workflowHas(combined, /\bnpm\s+run\s+lint\b|\bpnpm\s+lint\b|\byarn\s+lint\b|\bbiome\s+check\b|\beslint\b/i);
	const hasTest = workflowHas(combined, /\bnpm\s+(test|run\s+test)\b|\bpnpm\s+test\b|\byarn\s+test\b|\bvitest\b|\bplaywright\s+test\b/i);
	const hasBuild = workflowHas(combined, /\bnpm\s+run\s+build\b|\bpnpm\s+build\b|\byarn\s+build\b/i);
	const hasCheck = workflowHas(combined, /\bnpm\s+run\s+(check|typecheck)\b|\bpnpm\s+(check|typecheck)\b|\byarn\s+(check|typecheck)\b|\bsvelte-check\b|\btsc\b/i);
	const missing = [
		...(hasLint ? [] : ['lint']),
		...(hasTest ? [] : ['test']),
		...(hasBuild ? [] : ['build']),
		...(hasCheck ? [] : ['typecheck'])
	];
	const broadPermissions = workflowHas(combined, /^\s*permissions:\s*write-all\s*$/im);
	const readOnlyPermissions = workflowHas(combined, /^\s*contents:\s*read\s*$/im);
	const hasPullRequestTarget = workflowHas(combined, /^\s*pull_request_target\s*:?\s*$/im);
	const unsafePrContextInRun =
		hasPullRequestTarget &&
		workflowHas(
			combined,
			/run:\s*(?:\||[^\n]*)(?:[\s\S]{0,300})\$\{\{\s*github\.event\.(pull_request|issue|comment)\./i
		);
	const floating = floatingThirdPartyActions(combined);

	return [
		finding(
			'ci-runs-quality-gates',
			'CI runs quality gates',
			missing.length === 0 ? 'pass' : 'warn',
			missing.length === 0
				? 'GitHub Actions workflow runs lint, typecheck, test, and build quality gates.'
				: `GitHub Actions workflow is missing ${missing.join(', ')} gate${missing.length === 1 ? '' : 's'}.`,
			{ path: workflows[0].path }
		),
		finding(
			'workflow-permissions',
			'Workflow token permissions',
			broadPermissions ? 'warn' : 'pass',
			broadPermissions
				? 'Workflow uses permissions: write-all. Set contents: read by default and raise permissions only for jobs that need them.'
				: readOnlyPermissions
					? 'Workflow declares read-only contents permission.'
					: 'No write-all workflow permission detected.',
			{ path: workflows[0].path }
		),
		finding(
			'workflow-pull-request-target',
			'pull_request_target safety',
			unsafePrContextInRun ? 'fail' : hasPullRequestTarget ? 'warn' : 'pass',
			unsafePrContextInRun
				? 'pull_request_target workflow runs untrusted PR/issue context inside shell. Use a JavaScript action input or intermediate environment variable and avoid checking out untrusted code with write tokens.'
				: hasPullRequestTarget
					? 'pull_request_target is present. Review it carefully because it can expose privileged tokens to untrusted pull request data.'
					: 'No pull_request_target workflow trigger detected.',
			{ path: workflows[0].path }
		),
		finding(
			'workflow-action-pinning',
			'Action version pinning',
			floating.length === 0 ? 'pass' : 'warn',
			floating.length === 0
				? 'No floating third-party action refs detected.'
				: `Floating third-party action refs detected: ${floating.join(', ')}. Pin to a release tag or commit SHA.`,
			{ path: workflows[0].path }
		)
	];
}
```

- [ ] **Step 4: Run the tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts
git commit -m "Analyze GitHub Actions readiness"
```

## Task 6: Deploy And Runtime Config Analyzer

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/readiness.ts`
- Modify: `apps/preflight/src/lib/scan/repo/readiness.test.ts`

- [ ] **Step 1: Add failing tests**

Add import symbol `analyzeDeployConfig`.

Add tests:

```ts
it('warns on stale Wrangler compatibility dates', () => {
	const findings = analyzeDeployConfig(
		[rootManifest],
		[
			{
				path: 'wrangler.jsonc',
				text: '{ "compatibility_date": "2025-01-01" }'
			}
		],
		new Date('2026-07-05T00:00:00Z')
	);

	expect(findings.find((finding) => finding.id === 'deploy-config')).toMatchObject({
		status: 'pass'
	});
	expect(findings.find((finding) => finding.id === 'wrangler-compat-date')).toMatchObject({
		status: 'warn'
	});
});

it('fails Dockerfiles that copy dotenv files into the image', () => {
	const findings = analyzeDeployConfig(
		[rootManifest],
		[{ path: 'Dockerfile', text: 'FROM node:22\nCOPY .env .env\nRUN npm ci\n' }],
		new Date('2026-07-05T00:00:00Z')
	);

	expect(findings.find((finding) => finding.id === 'docker-env-copy')).toMatchObject({
		status: 'fail'
	});
});
```

- [ ] **Step 2: Run the failing tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: fail because `analyzeDeployConfig` is missing.

- [ ] **Step 3: Implement deploy config analyzer**

Add to `readiness.ts`:

```ts
const DEPLOY_CONFIG_PATTERNS = [
	/(^|\/)wrangler\.(jsonc?|toml)$/,
	/(^|\/)vercel\.json$/,
	/(^|\/)netlify\.toml$/,
	/(^|\/)Dockerfile$/,
	/(^|\/)docker-compose\.ya?ml$/
];

function monthsBetween(a: Date, b: Date): number {
	return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

function wranglerCompatibilityDate(text: string | null): Date | null {
	const match = text?.match(/compatibility_date["']?\s*[:=]\s*["'](\d{4}-\d{2}-\d{2})["']/);
	if (!match) return null;
	const date = new Date(`${match[1]}T00:00:00Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function analyzeDeployConfig(
	_manifests: PackageManifestEvidence[],
	files: RepoFileEvidence[],
	now = new Date()
): RepoReadinessFinding[] {
	const deployConfig = hasFile(files, DEPLOY_CONFIG_PATTERNS);
	const wrangler = hasFile(files, [/(^|\/)wrangler\.(jsonc?|toml)$/]);
	const docker = hasFile(files, [/(^|\/)Dockerfile$/]);
	const compatDate = wranglerCompatibilityDate(wrangler?.text ?? null);
	const staleCompat = compatDate ? monthsBetween(compatDate, now) > 6 : false;
	const dockerCopiesEnv = Boolean(docker?.text && /\b(COPY|ADD)\s+\.env(\s|$)/i.test(docker.text));

	return [
		finding(
			'deploy-config',
			'Deploy config',
			deployConfig ? 'pass' : 'warn',
			deployConfig
				? `Deploy/runtime config found at ${deployConfig.path}.`
				: 'No common deploy config found (Wrangler, Vercel, Netlify, Docker). If deploy is fully dashboard-managed, this may be fine.',
			deployConfig ? { path: deployConfig.path } : undefined
		),
		...(wrangler
			? [
					finding(
						'wrangler-compat-date',
						'Wrangler compatibility date',
						staleCompat ? 'warn' : 'pass',
						compatDate
							? staleCompat
								? `Wrangler compatibility_date is ${compatDate.toISOString().slice(0, 10)}, more than six months behind. Review Cloudflare runtime changes and update deliberately.`
								: `Wrangler compatibility_date is current enough: ${compatDate.toISOString().slice(0, 10)}.`
							: 'Wrangler config exists but no compatibility_date was detected.',
						{ path: wrangler.path }
					)
				]
			: []),
		...(docker
			? [
					finding(
						'docker-env-copy',
						'Docker dotenv copy',
						dockerCopiesEnv ? 'fail' : 'pass',
						dockerCopiesEnv
							? 'Dockerfile copies .env into the image. Use runtime secrets instead and add .env to .dockerignore.'
							: 'Dockerfile does not directly copy .env into the image.',
						{ path: docker.path }
					)
				]
			: [])
	];
}
```

- [ ] **Step 4: Run the tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/preflight/src/lib/scan/repo/readiness.ts apps/preflight/src/lib/scan/repo/readiness.test.ts
git commit -m "Analyze deploy config readiness"
```

## Task 7: Integrate Readiness Findings Into Repo Scan

**Files:**
- Modify: `apps/preflight/src/lib/scan/repo/scan.ts`
- Modify: `apps/preflight/src/lib/scan/repo/scan.test.ts`
- Modify: `apps/preflight/src/lib/scan/repo/audit.ts`
- Modify: `apps/preflight/src/lib/scan/repo/audit.test.ts`

- [ ] **Step 1: Add failing package parser test**

Add this test to `apps/preflight/src/lib/scan/repo/audit.test.ts`:

```ts
it('keeps parsed package metadata for static repo analyzers', () => {
	const parsed = parsePackageJson(
		JSON.stringify({
			scripts: { build: 'vite build' },
			packageManager: 'pnpm@10.0.0',
			devDependencies: { eslint: '^9.0.0' }
		})
	);

	expect(parsed.valid).toBe(true);
	expect(parsed.raw?.scripts?.build).toBe('vite build');
	expect(parsed.raw?.packageManager).toBe('pnpm@10.0.0');
	expect(parsed.raw?.devDependencies?.eslint).toBe('^9.0.0');
});
```

- [ ] **Step 2: Run the failing parser test**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/audit.test.ts -t "parsed package metadata"
```

Expected: fail because `parsePackageJson` does not expose `raw`.

- [ ] **Step 3: Extend `parsePackageJson` return shape**

In `apps/preflight/src/lib/scan/repo/audit.ts`, change the return type and parsed object section to:

```ts
export interface ParsedPackageJson {
	dependencies: Record<string, string>;
	valid: boolean;
	raw?: {
		scripts?: Record<string, string>;
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		optionalDependencies?: Record<string, string>;
		peerDependencies?: Record<string, string>;
		engines?: { node?: string };
		packageManager?: string;
		devEngines?: {
			packageManager?:
				| string
				| {
						name?: string;
						version?: string;
						onFail?: string;
				  };
		};
	};
}

export function parsePackageJson(text: string | null): ParsedPackageJson {
	if (!text) return { dependencies: {}, valid: false };
	try {
		const parsed = JSON.parse(text) as ParsedPackageJson['raw'];
		return {
			dependencies: {
				...(parsed?.dependencies ?? {}),
				...(parsed?.devDependencies ?? {}),
				...(parsed?.optionalDependencies ?? {}),
				...(parsed?.peerDependencies ?? {})
			},
			raw: parsed,
			valid: true
		};
	} catch {
		return { dependencies: {}, valid: false };
	}
}
```

- [ ] **Step 4: Run parser tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/audit.test.ts
```

Expected: pass.

- [ ] **Step 5: Add failing orchestration tests**

Add this test near the existing repo quality tests in `scan.test.ts`:

```ts
it('surfaces static repo readiness findings in the scan report', async () => {
	const report = await scanRepo(REF, {
		fetchers: fakeFetchers({
			entries: [
				...QUALITY_ENTRIES,
				{ path: 'eslint.config.js', type: 'blob' },
				{ path: 'biome.json', type: 'blob' },
				{ path: 'wrangler.jsonc', type: 'blob' }
			],
			files: {
				...QUALITY_FILES,
				'package.json': JSON.stringify({
					packageManager: 'npm@11.0.0',
					dependencies: { react: '^18.0.0' },
					devDependencies: {
						eslint: '^9.0.0',
						'@sveltejs/kit': '^2.0.0',
						'svelte-check': '^4.0.0',
						typescript: '^5.0.0'
					},
					engines: { node: '>=22' },
					scripts: {
						lint: 'eslint .',
						check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
						test: 'vitest run',
						build: 'vite build'
					}
				}),
				'.github/workflows/ci.yml': `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build
`,
				'eslint.config.js': 'export default [];',
				'biome.json': '{}',
				'wrangler.jsonc': '{ "compatibility_date": "2026-07-05" }'
			}
		}),
		npmLicense: async () => 'MIT',
		vulnAuditor: async () => null
	});

	const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
	expect(byId['package-scripts'].status).toBe('pass');
	expect(byId['lint-script'].status).toBe('pass');
	expect(byId['typecheck-script'].status).toBe('pass');
	expect(byId['svelte-check'].status).toBe('pass');
	expect(byId['package-manager-pinned'].status).toBe('pass');
	expect(byId['ci-runs-quality-gates'].status).toBe('pass');
	expect(byId['workflow-permissions'].status).toBe('pass');
	expect(byId['deploy-config'].status).toBe('pass');
	expect(report.repo?.filesSampled).toContain('wrangler.jsonc');
});
```

- [ ] **Step 6: Run the failing orchestration test**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/scan.test.ts -t "surfaces static repo readiness findings"
```

Expected: fail because `scan.ts` does not call readiness analyzers.

- [ ] **Step 7: Import readiness analyzers in `scan.ts`**

Add imports:

```ts
import {
	analyzeCiWorkflows,
	analyzeDeployConfig,
	analyzeLintSetup,
	analyzePackageManager,
	analyzePackageScripts,
	analyzeTypescriptSetup,
	type PackageManifestEvidence,
	type RepoFileEvidence,
	type RepoReadinessFinding
} from '$lib/scan/repo/readiness';
```

- [ ] **Step 8: Add config path discovery helpers in `scan.ts`**

Add near the existing package path helpers:

```ts
const STATIC_CONFIG_LIMIT = 48;

function findStaticConfigPaths(entries: RepoTreeEntry[]): string[] {
	const patterns = [
		/(^|\/)eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/,
		/(^|\/)\.eslintrc(\.(json|js|cjs|yml|yaml))?$/,
		/(^|\/)biome\.jsonc?$/,
		/(^|\/)\.prettierrc(\.(json|js|cjs|mjs|yml|yaml))?$/,
		/(^|\/)prettier\.config\.(js|cjs|mjs|ts)$/,
		/(^|\/)tsconfig\.json$/,
		/^\.github\/workflows\/[^/]+\.(ya?ml)$/,
		/(^|\/)wrangler\.(jsonc?|toml)$/,
		/(^|\/)vercel\.json$/,
		/(^|\/)netlify\.toml$/,
		/(^|\/)Dockerfile$/,
		/(^|\/)docker-compose\.ya?ml$/,
		/^package-lock\.json$/,
		/^npm-shrinkwrap\.json$/,
		/^pnpm-lock\.yaml$/,
		/^yarn\.lock$/,
		/^bun\.lockb?$/
	];

	return entries
		.filter((entry) => entry.type === 'blob' && !isVendoredPath(entry.path))
		.map((entry) => entry.path)
		.filter((path) => patterns.some((pattern) => pattern.test(path)))
		.slice(0, STATIC_CONFIG_LIMIT);
}

function manifestEvidence(
	paths: string[],
	texts: (string | null)[]
): PackageManifestEvidence[] {
	return paths.flatMap((path, index) => {
		const parsed = parsePackageJson(texts[index]);
		return parsed.valid ? [{ path, json: parsed.raw }] : [];
	});
}

function repoReadinessChecks(url: string, findings: RepoReadinessFinding[]): ScanCheck[] {
	return findings.map((item) =>
		makeCheck(item.id, item.category, item.title, item.status, item.message, fixPrompt(item.id, {
			url,
			message: item.message
		}))
	);
}
```

- [ ] **Step 9: Fetch static config files in `scan.ts`**

After `const tsconfigPath = ...`, add:

```ts
const staticConfigPaths = findStaticConfigPaths(entries);
```

Add `staticConfigTexts` to the existing `Promise.all` destructuring and promise list:

```ts
const [
	packageJsonTexts,
	readmeText,
	gitignoreText,
	lockfileTexts,
	tsconfigText,
	envTexts,
	sampleTexts,
	staticConfigTexts
] = await Promise.all([
	Promise.all(packageJsonPaths.map((path) => getFile(path))),
	getFile(readmePath),
	getFile(gitignorePath),
	Promise.all(lockfilePaths.map((path) => getFile(path, MAX_LOCKFILE_BYTES))),
	getFile(tsconfigPath),
	Promise.all(envFiles.slice(0, 2).map((p) => getFile(p))),
	Promise.all(sampleFiles.map((p) => getFile(p))),
	Promise.all(staticConfigPaths.map((path) => getFile(path, MAX_LOCKFILE_BYTES)))
]);
```

- [ ] **Step 10: Build readiness evidence and checks**

After `parsedManifests` is created, add:

```ts
const packageEvidence = manifestEvidence(packageJsonPaths, packageJsonTexts);
const staticFiles: RepoFileEvidence[] = staticConfigPaths.map((path, index) => ({
	path,
	text: staticConfigTexts[index] ?? null
}));
```

Before constructing `repo`, add:

```ts
const readinessFindings = [
	...analyzePackageScripts(packageEvidence),
	...analyzeLintSetup(packageEvidence, staticFiles),
	...analyzePackageManager(packageEvidence, staticFiles),
	...analyzeTypescriptSetup(packageEvidence, staticFiles),
	...analyzeCiWorkflows(staticFiles),
	...analyzeDeployConfig(packageEvidence, staticFiles)
];
checks.push(...repoReadinessChecks(url, readinessFindings));
```

- [ ] **Step 11: Include config evidence in sampled files**

In the `repo.filesSampled` set, add:

```ts
...staticConfigPaths,
```

- [ ] **Step 12: Run repo scan tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/scan.test.ts
```

Expected: pass.

- [ ] **Step 13: Commit**

```powershell
git add apps/preflight/src/lib/scan/repo/scan.ts apps/preflight/src/lib/scan/repo/scan.test.ts apps/preflight/src/lib/scan/repo/audit.ts apps/preflight/src/lib/scan/repo/audit.test.ts
git commit -m "Integrate repo readiness findings"
```

## Task 8: Fix Prompts For New Repo Checks

**Files:**
- Modify: `apps/preflight/src/lib/scan/prompts.ts`
- Modify: `apps/preflight/src/lib/scan/prompts.test.ts`

- [ ] **Step 1: Add failing prompt tests**

Add this test to `prompts.test.ts`:

```ts
it('has targeted prompts for repo readiness checks', () => {
	const ids = [
		'package-scripts',
		'lint-script',
		'format-script',
		'typecheck-script',
		'build-script',
		'package-manager-pinned',
		'mixed-lockfiles',
		'ci-runs-quality-gates',
		'workflow-permissions',
		'workflow-pull-request-target',
		'workflow-action-pinning',
		'svelte-check',
		'deploy-config',
		'wrangler-compat-date',
		'docker-env-copy'
	];

	for (const id of ids) {
		const prompt = fixPrompt(id, { url: 'https://github.com/acme/app', message: 'Evidence line' });
		expect(prompt).toContain(`Check: ${id}`);
		expect(prompt).toContain('Evidence: Evidence line');
		expect(prompt).not.toContain('Fix this launch readiness issue before sharing the site publicly.');
	}
});
```

- [ ] **Step 2: Run the failing test**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/prompts.test.ts -t "repo readiness checks"
```

Expected: fail because prompts fall through to generic fallback.

- [ ] **Step 3: Add prompt entries**

Add these entries to the `templates` object in `prompts.ts`:

```ts
'package-scripts': `${base}Expose the core repo quality commands in root package.json: "lint", "test", and "build". In monorepos, root scripts can delegate to turbo/pnpm/yarn workspaces, but a developer should be able to run one root command before pushing.`,
'lint-script': `${base}Wire linting into package.json. If ESLint is configured, add "lint": "eslint .". If Biome is configured, add "lint": "biome check .". Keep the command read-only; use a separate format command for writes.`,
'format-script': `${base}Add a formatting command so contributors can normalize changes before pushing. Use "format": "prettier --write ." for Prettier or "format": "biome format --write ." for Biome.`,
'typecheck-script': `${base}Add a typecheck command. For TypeScript apps use "typecheck": "tsc --noEmit". For SvelteKit use "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json". Run it in CI before build.`,
'build-script': `${base}Add a real build script to root package.json, such as "build": "vite build", "build": "svelte-kit sync && vite build", or a monorepo command like "turbo run build". Do not use true or exit 0 as a placeholder.`,
'package-manager-pinned': `${base}Pin the package manager in root package.json with Corepack, for example "packageManager": "pnpm@10.0.0" or "npm@11.0.0". The pinned manager should match the committed lockfile so installs are deterministic.`,
'mixed-lockfiles': `${base}Pick one package manager and remove extra root lockfiles. npm uses package-lock.json, pnpm uses pnpm-lock.yaml, Yarn uses yarn.lock, and Bun uses bun.lock/bun.lockb. Commit exactly one root lockfile for JavaScript projects.`,
'ci-runs-quality-gates': `${base}Update CI so pull requests run the same quality gates a developer runs locally: install with the pinned package manager, then lint, typecheck/check, test, and build. Put fast checks before build so failures are obvious.`,
'workflow-permissions': `${base}Reduce GitHub Actions token permissions. Set a workflow or job default like permissions: { contents: read }, then grant write scopes only to the one job that comments, publishes, or deploys.`,
'workflow-pull-request-target': `${base}Review this pull_request_target workflow as a security issue. Do not run untrusted PR titles, bodies, comments, or branch code inside shell with privileged tokens. Move context values into environment variables, use a JavaScript action input, or switch to pull_request when write permissions are unnecessary.`,
'workflow-action-pinning': `${base}Pin third-party GitHub Actions to a stable release tag or commit SHA. Avoid @main, @master, @latest, or moving branches for third-party actions because an upstream change can alter your CI without a code review.`,
'svelte-check': `${base}SvelteKit detected. Add svelte-check to devDependencies and expose "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json". This catches template, prop, and route typing issues that plain tsc misses.`,
'deploy-config': `${base}Add deploy/runtime config to the repo when deployment is code-owned. For Cloudflare Workers use wrangler.jsonc, for Vercel use vercel.json when defaults are not enough, for Netlify use netlify.toml, and for containers include a Dockerfile plus .dockerignore.`,
'wrangler-compat-date': `${base}Update Wrangler compatibility_date deliberately. Read Cloudflare runtime compatibility notes, choose a recent date, run the app's verify suite, deploy, and watch logs. Do not blindly update it without tests.`,
'docker-env-copy': `${base}Remove dotenv files from the Docker image. Delete COPY .env lines, add .env and .env.* to .dockerignore, pass secrets at runtime through the hosting platform, and rotate any secret that was baked into an image.`
```

- [ ] **Step 4: Run prompt tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/prompts.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/preflight/src/lib/scan/prompts.ts apps/preflight/src/lib/scan/prompts.test.ts
git commit -m "Add repo readiness fix prompts"
```

## Task 9: Full Verification And Dogfood

**Files:**
- Modify only if verification exposes defects.

- [ ] **Step 1: Run focused tests**

```powershell
npm.cmd run test -w preflight -- src/lib/scan/repo/readiness.test.ts src/lib/scan/repo/scan.test.ts src/lib/scan/prompts.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 2: Run Svelte/TypeScript checks**

```powershell
npm.cmd run check -w preflight
```

Expected: `svelte-check found 0 errors and 0 warnings`.

- [ ] **Step 3: Run full preflight verification**

```powershell
npm.cmd run verify:preflight
```

Expected: check, lint, tests, and build all pass.

- [ ] **Step 4: Dogfood with a public GitHub repo URL**

Use the Deploylint UI or API to scan this repository once deployed. Confirm the report shows new repo readiness checks with clear messages:

- package scripts
- lint script
- typecheck script
- package manager pin
- CI quality gates
- workflow permissions
- deploy config

No new finding should claim code execution happened.

- [ ] **Step 5: Commit any verification fixes**

If Step 1-4 required fixes:

```powershell
git add apps/preflight/src/lib/scan
git commit -m "Verify repo readiness scanner"
```

If no fixes were needed, do not create an empty commit.

## Deployment Plan

After Task 9 passes:

- Run `npm.cmd exec -w preflight -- wrangler deploy`.
- Verify `https://deploylint.com/` is 200.
- Run one live repo scan.
- If live output looks good, commit any generated docs only if files changed.
- Push the branch.

## Done Criteria

- `npm.cmd run verify:preflight` passes.
- New readiness analyzers are covered by focused unit tests.
- `scanRepo` integrates the new checks and preserves current report shape.
- New prompt IDs do not fall back to generic prompt text.
- No untrusted code execution was added.
- The scanner is meaningfully better for a developer asking, "Can I push or launch this repo?"
