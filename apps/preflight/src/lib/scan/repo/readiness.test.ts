import { describe, expect, it } from 'vitest';
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
});
