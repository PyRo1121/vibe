import { describe, expect, it } from 'vitest';

import {
	analyzeCiWorkflows,
	analyzeBillingReadiness,
	analyzeDeployConfig,
	analyzeLintSetup,
	analyzePackageManager,
	analyzePackageScripts,
	analyzeTypescriptSetup,
	type PackageManifestEvidence,
	type RepoFileEvidence,
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

const FULL_ACTION_SHA = '0123456789abcdef0123456789abcdef01234567';

describe('repo readiness analyzer', () => {
	it('returns normalized findings for package script readiness', () => {
		const findings: RepoReadinessFinding[] = analyzePackageScripts([rootManifest]);

		expect(findings.map((finding) => finding.id)).toContain('package-scripts');
		expect(findings.find((finding) => finding.id === 'package-scripts')).toMatchObject({
			category: 'launch',
			title: 'Package scripts',
			status: 'pass',
			engine: 'deploylint-static',
			confidence: 'high',
			launchImpact: 'watch',
			ruleId: 'package-scripts',
			fixPromptId: 'package-scripts'
		});
	});

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

	it('uses the first package manifest when a root manifest is unavailable', () => {
		const findings = analyzePackageScripts([
			{
				path: 'apps/web/package.json',
				json: {
					scripts: {
						lint: 'eslint .',
						test: 'vitest run',
						build: 'vite build',
						check: 'tsc --noEmit'
					}
				}
			}
		]);

		expect(findings.find((finding) => finding.id === 'package-scripts')).toMatchObject({
			status: 'pass',
			evidence: { path: 'apps/web/package.json' }
		});
		expect(findings.find((finding) => finding.id === 'typecheck-script')).toMatchObject({
			status: 'pass'
		});
	});

	it('warns when no package manifest evidence is available', () => {
		const findings = analyzePackageScripts([]);

		expect(findings.find((finding) => finding.id === 'package-scripts')).toMatchObject({
			status: 'warn',
			message: 'Root package.json is missing lint, test, build scripts.'
		});
		expect(findings.find((finding) => finding.id === 'package-scripts')?.evidence).toBeUndefined();
	});

	it('passes modern ESLint flat config and warns when Prettier has no format script', () => {
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

	it('warns when lint config exists but root scripts do not invoke it', () => {
		const findings = analyzeLintSetup(
			[{ path: 'package.json', json: { scripts: { test: 'vitest run' } } }],
			[{ path: '.eslintrc.json', text: '{}' }]
		);

		expect(findings.find((finding) => finding.id === 'lint-script')).toMatchObject({
			status: 'warn',
			message: 'Lint config exists, but root package.json does not run it from lint or check.',
			evidence: { path: '.eslintrc.json' }
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

	it('warns when SvelteKit installs svelte-check but scripts do not run it', () => {
		const findings = analyzeTypescriptSetup(
			[
				{
					path: 'package.json',
					json: {
						scripts: { check: 'tsc --noEmit' },
						devDependencies: {
							'@sveltejs/kit': '^2.0.0',
							'svelte-check': '^4.0.0',
							typescript: '^5.0.0'
						}
					}
				}
			],
			[{ path: 'tsconfig.json', text: JSON.stringify({ compilerOptions: { strict: true } }) }]
		);

		expect(findings.find((finding) => finding.id === 'typecheck-script')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'svelte-check')).toMatchObject({
			status: 'warn',
			message: 'svelte-check is installed, but no check/typecheck script invokes it.'
		});
	});

	it('passes pinned package manager with matching lockfile', () => {
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

	it('accepts devEngines package manager pins with matching lockfiles', () => {
		const stringPinFindings = analyzePackageManager(
			[
				{
					path: 'package.json',
					json: { devEngines: { packageManager: 'pnpm@10.0.0' } }
				}
			],
			[{ path: 'pnpm-lock.yaml', text: 'lockfileVersion: 9.0' }]
		);
		const objectPinFindings = analyzePackageManager(
			[
				{
					path: 'package.json',
					json: { devEngines: { packageManager: { name: 'yarn', version: '4.9.0' } } }
				}
			],
			[{ path: 'yarn.lock', text: '# yarn lockfile' }]
		);

		expect(
			stringPinFindings.find((finding) => finding.id === 'package-manager-pinned')
		).toMatchObject({ status: 'pass' });
		expect(
			objectPinFindings.find((finding) => finding.id === 'package-manager-pinned')
		).toMatchObject({ status: 'pass' });
	});

	it('warns on mixed lockfiles and package manager mismatch', () => {
		const findings = analyzePackageManager(
			[{ path: 'package.json', json: { packageManager: 'npm@11.0.0' } }],
			[
				{ path: 'package-lock.json', text: '{}' },
				{ path: 'pnpm-lock.yaml', text: 'lockfileVersion: 9.0' }
			]
		);

		expect(findings.find((finding) => finding.id === 'mixed-lockfiles')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'package-manager-pinned')?.message).toContain(
			'does not match committed lockfile'
		);
	});

	it('passes CI workflows that run quality gates with least-privilege permissions', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
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
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'ci-runs-quality-gates')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'pass'
		});
	});

	it('passes Deploylint PR advisory workflow wiring when the hosted gate is installed', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/deploylint.yml',
				text: `
name: Deploylint
on: [pull_request]
permissions:
  contents: read
  pull-requests: write
jobs:
  deploylint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build
      - name: Deploylint advisory
        env:
          DEPLOYLINT_URL: \${{ secrets.DEPLOYLINT_URL }}
          DEPLOYLINT_MODE: advisory
        run: |
          curl -fsSL https://deploylint.com/gate-remote.mjs -o gate-remote.mjs
          node gate-remote.mjs "$DEPLOYLINT_URL"
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'deploylint-ci-wiring')).toMatchObject({
			status: 'pass',
			evidence: { path: '.github/workflows/deploylint.yml' }
		});
	});

	it('warns when Deploylint PR advisory workflow wiring only appears in comments', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build
      # - name: Deploylint advisory
      #   env:
      #     DEPLOYLINT_URL: \${{ secrets.DEPLOYLINT_URL }}
      #     DEPLOYLINT_MODE: advisory
      #   run: node gate-remote.mjs "$DEPLOYLINT_URL"
      #   curl -fsSL https://deploylint.com/gate-remote.mjs
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'deploylint-ci-wiring')).toMatchObject({
			status: 'warn',
			message: expect.stringContaining('No Deploylint advisory or gate workflow')
		});
	});

	it('warns when CI lacks Deploylint PR advisory workflow wiring', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'deploylint-ci-wiring')).toMatchObject({
			status: 'warn',
			message: expect.stringContaining('No Deploylint advisory or gate workflow')
		});
	});

	it('ignores step input write values outside actual permission blocks', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: acme/configure@v1
        with:
          mode: write
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'pass'
		});
	});

	it('passes dependency review and update automation when configured', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/dependency-review.yml',
				text: `
name: Dependency Review
on: [pull_request]
permissions:
  contents: read
  pull-requests: read
jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
`
			},
			{
				path: '.github/dependabot.yml',
				text: `
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'dependency-review-action')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'dependabot-config')).toMatchObject({
			status: 'pass'
		});
	});

	it('passes immutable action pinning when external actions use full commit SHAs', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/security.yml',
				text: `
name: Security
on: [pull_request]
permissions:
  contents: read
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${FULL_ACTION_SHA}
      - uses: github/codeql-action/init@${FULL_ACTION_SHA}
      - uses: github/codeql-action/analyze@${FULL_ACTION_SHA}
      - uses: actions/dependency-review-action@${FULL_ACTION_SHA}
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
			status: 'pass'
		});
		expect(
			findings.find((finding) => finding.id === 'workflow-immutable-action-pins')
		).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'codeql-code-scanning')).toMatchObject({
			status: 'pass'
		});
	});

	it('warns on version-tagged actions without treating them as floating branch refs', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/security.yml',
				text: `
name: Security
on: [pull_request]
permissions:
  contents: read
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v4
      - uses: github/codeql-action/analyze@v4
      - uses: actions/dependency-review-action@v4
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
			status: 'pass'
		});
		expect(
			findings.find((finding) => finding.id === 'workflow-immutable-action-pins')
		).toMatchObject({
			status: 'warn',
			message: 'GitHub Action actions/checkout@v4 is not pinned to a full commit SHA.',
			evidence: { path: '.github/workflows/security.yml' }
		});
		expect(findings.find((finding) => finding.id === 'codeql-code-scanning')).toMatchObject({
			status: 'pass'
		});
	});

	it('ignores local reusable workflows and docker references for immutable action pins', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    uses: ./.github/workflows/reusable.yml
  container-check:
    runs-on: ubuntu-latest
    steps:
      - uses: docker://alpine@sha256:0123456789abcdef
      - run: npm test
`
			}
		]);

		expect(
			findings.find((finding) => finding.id === 'workflow-immutable-action-pins')
		).toMatchObject({
			status: 'pass'
		});
	});

	it('warns when CodeQL code scanning is not visible in workflows', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${FULL_ACTION_SHA}
      - run: npm test
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'codeql-code-scanning')).toMatchObject({
			status: 'warn',
			message: expect.stringContaining('No CodeQL code scanning workflow found')
		});
	});

	it('warns when dependency review and update automation are missing', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'dependency-review-action')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'dependabot-config')).toMatchObject({
			status: 'warn'
		});
	});

	it('warns when GitHub Actions workflows do not declare token permissions', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
jobs:
  verify:
    steps:
      - uses: actions/checkout@v4
      - run: npm test
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'warn'
		});
	});

	it('warns when any workflow omits token permissions', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    steps:
      - run: npm test
`
			},
			{
				path: '.github/workflows/deploy.yml',
				text: `
name: Deploy
on: [push]
jobs:
  deploy:
    steps:
      - run: npm run deploy
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'warn',
			evidence: { path: '.github/workflows/deploy.yml' }
		});
	});

	it('warns when workflows request broad write token scopes', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/release.yml',
				text: `
name: Release
on: [push]
permissions:
  contents: write
  packages: write
jobs:
  release:
    steps:
      - run: npm test
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'warn',
			message: expect.stringContaining('contents, packages'),
			evidence: { path: '.github/workflows/release.yml' }
		});
	});

	it('warns when workflows request write token scopes in inline permission maps', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/release.yml',
				text: `
name: Release
on: [push]
permissions: { contents: write, packages: read }
jobs:
  release:
    steps:
      - run: npm test
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'warn',
			message: expect.stringContaining('contents'),
			evidence: { path: '.github/workflows/release.yml' }
		});
	});

	it('fails pull_request_target workflows with clear untrusted script execution', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/pr.yml',
				text: `
on: pull_request_target
permissions: write-all
jobs:
  label:
    steps:
      - run: echo "\${{ github.event.pull_request.title }}"
      - uses: third-party/action@main
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-pull-request-target')).toMatchObject(
			{
				status: 'fail'
			}
		);
		expect(findings.find((finding) => finding.id === 'workflow-permissions')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
			status: 'warn'
		});
	});

	it('warns on pull_request_target workflows even when they avoid obvious unsafe checkout', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/label.yml',
				text: `
name: Label
on:
  pull_request_target:
permissions:
  contents: read
  pull-requests: write
jobs:
  label:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-pull-request-target')).toMatchObject(
			{
				status: 'warn',
				message: 'pull_request_target workflow found; review token and checkout behavior carefully.'
			}
		);
	});

	it('fails pull_request_target workflows that opt into unsafe fork checkout', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/pr.yml',
				text: `
on: pull_request_target
permissions:
  contents: write
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: \${{ github.event.pull_request.head.sha }}
          repository: \${{ github.event.pull_request.head.repo.full_name }}
          allow-unsafe-pr-checkout: true
      - run: npm test
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'workflow-pull-request-target')).toMatchObject(
			{
				status: 'fail',
				launchImpact: 'blocker'
			}
		);
	});

	it('parses quoted run commands, empty run values, and malformed action refs', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    steps:
      - uses: actions/checkout@v4
      - uses: "acme/deploy@latest"
      - uses: 'acme/no-ref'
      - uses: acme/empty@
      - run: ""
      - run: ''
      - run: >
          npm run lint
          npm run check

          npm test
          npm run build
      - name: Done
        run: echo ok
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'ci-runs-quality-gates')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
			status: 'warn'
		});
	});

	it('ignores commented-out quality gates and floating action refs', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    steps:
      # - uses: third-party/action@main
      # - run: npm run lint
      # - run: npm run check
      # - run: npm test
      # - run: npm run build
      - uses: actions/checkout@v4
      - run: npm ci
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'ci-runs-quality-gates')).toMatchObject({
			status: 'warn'
		});
		expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
			status: 'pass'
		});
	});

	it('detects multiline run blocks and quoted floating third-party action refs', () => {
		const findings = analyzeCiWorkflows([
			{
				path: '.github/workflows/ci.yml',
				text: `
name: CI
on: [pull_request]
permissions:
  contents: read
jobs:
  verify:
    steps:
      - uses: actions/checkout@v4
      - uses: "acme/deploy@main"
      - run: |
          npm run lint
          npm run check
          npm test
          npm run build
`
			}
		]);

		expect(findings.find((finding) => finding.id === 'ci-runs-quality-gates')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'workflow-action-pinning')).toMatchObject({
			status: 'warn'
		});
	});

	it('passes deploy config and warns on stale Wrangler compatibility date', () => {
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

	it('passes deploy config with invalid Wrangler compatibility date and safe Dockerfile', () => {
		const findings = analyzeDeployConfig(
			[rootManifest],
			[
				{
					path: 'wrangler.toml',
					text: 'name = "app"\ncompatibility_date = "2026-99-99"\n'
				},
				{ path: 'Dockerfile', text: 'FROM node:22\nRUN npm ci\nCOPY . .\n' }
			],
			new Date('2026-07-05T00:00:00Z')
		);

		expect(findings.find((finding) => finding.id === 'deploy-config')).toMatchObject({
			status: 'pass',
			evidence: { path: 'wrangler.toml' }
		});
		expect(findings.find((finding) => finding.id === 'wrangler-compat-date')).toMatchObject({
			status: 'pass',
			message: 'Wrangler config exists but no compatibility_date was detected.'
		});
		expect(findings.find((finding) => finding.id === 'docker-env-copy')).toMatchObject({
			status: 'pass',
			message: 'Dockerfile does not directly copy .env into the image.'
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

	it('fails Stripe webhook handlers without signature verification', () => {
		const findings = analyzeBillingReadiness(
			[
				{
					path: 'package.json',
					json: { dependencies: { stripe: '^20.0.0' } }
				}
			],
			[
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
import Stripe from 'stripe';

export async function POST({ request }) {
  const event = await request.json();
  if (event.type === 'checkout.session.completed') return new Response('ok');
}
`
				}
			]
		);

		expect(findings.find((finding) => finding.id === 'webhook-signature-missing')).toMatchObject({
			status: 'fail',
			category: 'payments',
			launchImpact: 'blocker'
		});
	});

	it('passes Stripe webhook handlers with signature verification', () => {
		const findings = analyzeBillingReadiness(
			[
				{
					path: 'package.json',
					json: { dependencies: { stripe: '^20.0.0' } }
				}
			],
			[
				{
					path: 'src/routes/api/webhooks/stripe/+server.ts',
					text: `
const signature = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(await request.text(), signature, env.STRIPE_WEBHOOK_SECRET);
`
				},
				{
					path: 'src/routes/account/billing/+server.ts',
					text: 'await stripe.billingPortal.sessions.create({ customer });'
				}
			]
		);

		expect(findings.find((finding) => finding.id === 'webhook-signature-missing')).toMatchObject({
			status: 'pass'
		});
		expect(findings.find((finding) => finding.id === 'billing-portal')).toMatchObject({
			status: 'pass'
		});
	});

	it('warns when Stripe subscription code has no customer billing portal signal', () => {
		const findings = analyzeBillingReadiness(
			[
				{
					path: 'package.json',
					json: { dependencies: { stripe: '^20.0.0' } }
				}
			],
			[
				{
					path: 'src/lib/checkout.ts',
					text: "await stripe.checkout.sessions.create({ mode: 'subscription', line_items: [] });"
				}
			]
		);

		expect(findings.find((finding) => finding.id === 'billing-portal')).toMatchObject({
			status: 'warn',
			category: 'payments',
			launchImpact: 'fix-soon'
		});
	});

	it('does not emit billing findings when no payment provider is detected', () => {
		const findings = analyzeBillingReadiness(
			[rootManifest],
			[{ path: 'src/routes/api/webhooks/github/+server.ts', text: 'export const POST = () => {};' }]
		);

		expect(findings).toEqual([]);
	});
});
