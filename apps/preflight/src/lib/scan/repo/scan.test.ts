import type { RepoFetchers, RepoMeta, RepoTreeEntry } from '$lib/scan/repo/github';
import { RepoScanError } from '$lib/scan/repo/github';
import { scanRepo } from '$lib/scan/repo/scan';
import { describe, expect, it } from 'vitest';

const REF = { owner: 'acme', repo: 'launchpad' };

const META: RepoMeta = {
	branch: 'main',
	description: 'A test app',
	stars: 42,
	licenseSpdx: 'MIT'
};

const README = `# Launchpad\n\n${'word '.repeat(120)}`;

function fakeFetchers(opts: {
	meta?: Partial<RepoMeta>;
	entries?: RepoTreeEntry[];
	files?: Record<string, string>;
	metaError?: Error;
	onGetFile?: (path: string) => void;
}): RepoFetchers {
	return {
		async getMeta() {
			if (opts.metaError) throw opts.metaError;
			return { ...META, ...opts.meta };
		},
		async getTree() {
			return { entries: opts.entries ?? [], truncated: false };
		},
		async getFile(_ref, _branch, path) {
			opts.onGetFile?.(path);
			return opts.files?.[path] ?? null;
		}
	};
}

const CLEAN_ENTRIES: RepoTreeEntry[] = [
	{ path: 'package.json', type: 'blob' },
	{ path: 'README.md', type: 'blob' },
	{ path: '.gitignore', type: 'blob' },
	{ path: 'src/index.ts', type: 'blob' }
];

const CLEAN_FILES: Record<string, string> = {
	'package.json': JSON.stringify({ dependencies: { react: '^18.0.0' } }),
	'README.md': README,
	'.gitignore': 'node_modules/\n.env\n.env.*\n',
	'src/index.ts': 'export const hello = 1;'
};

describe('scanRepo', () => {
	it('produces a clean report for a healthy repo', async () => {
		const healthyEntries: RepoTreeEntry[] = [
			...CLEAN_ENTRIES,
			{ path: 'package-lock.json', type: 'blob' },
			{ path: '.github/workflows/ci.yml', type: 'blob' },
			{ path: 'src/index.test.ts', type: 'blob' },
			{ path: 'src/lib/billing.test.ts', type: 'blob' },
			{ path: 'e2e/checkout.spec.ts', type: 'blob' },
			{ path: '.nvmrc', type: 'blob' },
			{ path: 'tsconfig.json', type: 'blob' },
			{ path: 'eslint.config.js', type: 'blob' },
			{ path: '.prettierrc', type: 'blob' },
			{ path: 'wrangler.jsonc', type: 'blob' }
		];
		const healthyFiles: Record<string, string> = {
			...CLEAN_FILES,
			'package.json': JSON.stringify({
				packageManager: 'npm@11.0.0',
				dependencies: { react: '^18.0.0' },
				devDependencies: { eslint: '^9.0.0', prettier: '^3.0.0', typescript: '^5.0.0' },
				engines: { node: '>=22' },
				scripts: {
					lint: 'eslint .',
					format: 'prettier --write .',
					typecheck: 'tsc --noEmit',
					test: 'vitest run --coverage',
					'test:e2e': 'playwright test',
					build: 'vite build'
				}
			}),
			'package-lock.json': JSON.stringify({
				lockfileVersion: 3,
				packages: {
					'': { name: 'launchpad' },
					'node_modules/react': { version: '18.2.0' }
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
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
`,
			'src/index.test.ts':
				'import { expect, it } from "vitest";\nimport { hello } from "./index";\nit("exports the launch value", () => expect(hello).toBe(1));',
			'src/lib/billing.test.ts': `
import { expect, it } from "vitest";
import { canAccessPlan } from "./billing";
it("does not grant access to canceled subscribers", () => {
  expect(canAccessPlan({ status: "canceled", plan: "pro" })).toEqual({ allowed: false, reason: "canceled" });
});
`,
			'e2e/checkout.spec.ts': `
import { expect, test } from "@playwright/test";
test("pricing CTA reaches checkout", async ({ page }) => {
  await page.goto("/pricing");
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect(page).toHaveURL(/checkout/);
});
`,
			'.nvmrc': '22\n',
			'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
			'eslint.config.js': 'export default [];',
			'.prettierrc': '{}',
			'wrangler.jsonc': '{ "compatibility_date": "2026-07-05" }'
		};
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({ entries: healthyEntries, files: healthyFiles }),
			npmLicense: async () => 'MIT',
			vulnAuditor: async (packages) => ({
				checked: packages.length,
				findings: [],
				worstSeverity: null
			})
		});

		expect(report.repo).toMatchObject({
			owner: 'acme',
			repo: 'launchpad',
			branch: 'main',
			license: 'MIT',
			depCount: 4
		});
		expect(report.url).toBe('https://github.com/acme/launchpad');
		expect(report.scanCoverage).toBe('full');

		const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
		expect(byId['env-committed'].status).toBe('pass');
		expect(byId.secrets.status).toBe('pass');
		expect(byId['gitignore-env'].status).toBe('pass');
		expect(byId['repo-license'].status).toBe('pass');
		expect(byId['license-risk'].status).toBe('pass');
		expect(byId.readme.status).toBe('pass');
		expect(byId['package-scripts'].status).toBe('pass');
		expect(byId['test-depth'].status).toBe('pass');
		expect(byId['ci-runs-quality-gates'].status).toBe('pass');
		expect(byId['deploy-config'].status).toBe('pass');
		expect(report.licenseAudit?.sellable).toBe('yes');
		expect(report.verdict).toBe('go');
	});

	it('fails hard on committed .env with live secrets', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [...CLEAN_ENTRIES, { path: '.env', type: 'blob' }],
				files: {
					...CLEAN_FILES,
					'.env': `STRIPE_KEY=sk_live_${'a'.repeat(24)}\n`
				}
			}),
			npmLicense: async () => 'MIT'
		});

		const env = report.checks.find((c) => c.id === 'env-committed');
		expect(env?.status).toBe('fail');
		expect(env?.message).toContain('.env');
		expect(env?.message).toContain('Stripe live secret key');
		expect(env?.priority).toBe('p0');
		expect(report.verdict).toBe('no-go');
	});

	it('downgrades dev env fixtures without secrets to a warning', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [...CLEAN_ENTRIES, { path: 'config/.env.dev', type: 'blob' }],
				files: { ...CLEAN_FILES, 'config/.env.dev': 'DATABASE_URL=postgres://localhost/dev\n' }
			}),
			npmLicense: async () => 'MIT'
		});

		const env = report.checks.find((c) => c.id === 'env-committed');
		expect(env?.status).toBe('warn');
		expect(report.verdict).not.toBe('no-go');
	});

	it('flags secrets found in sampled source files', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: CLEAN_ENTRIES,
				files: {
					...CLEAN_FILES,
					'src/index.ts': `const key = "AKIA${'A'.repeat(16)}";`
				}
			}),
			npmLicense: async () => 'MIT'
		});

		const secrets = report.checks.find((c) => c.id === 'secrets');
		expect(secrets?.status).toBe('fail');
		expect(secrets?.message).toContain('AWS access key');
	});

	it('flags secrets found only in payment-selected source files', async () => {
		const paymentPath = 'src/routes/api/checkout/+server.ts';
		const highSignalSamples = [
			'src/config/app.ts',
			'src/config/auth.ts',
			'src/config/db.ts',
			'src/config/email.ts',
			'src/config/env.ts',
			'src/config/firebase.ts',
			'src/config/secrets.ts',
			'src/config/settings.ts'
		];
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [
					...CLEAN_ENTRIES,
					...highSignalSamples.map((path) => ({ path, type: 'blob' as const })),
					{ path: paymentPath, type: 'blob' }
				],
				files: {
					...CLEAN_FILES,
					...Object.fromEntries(
						highSignalSamples.map((path) => [path, 'export const value = true;'])
					),
					[paymentPath]: `const stripe = new Stripe('sk_live_${'a'.repeat(24)}');`
				}
			}),
			npmLicense: async () => 'MIT'
		});

		const secrets = report.checks.find((c) => c.id === 'secrets');
		expect(secrets?.status).toBe('fail');
		expect(secrets?.message).toContain('Stripe live secret key');
	});

	it('warns on missing license and flags GPL dependencies as sell risk', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				meta: { licenseSpdx: null },
				entries: CLEAN_ENTRIES,
				files: {
					...CLEAN_FILES,
					'package.json': JSON.stringify({ dependencies: { 'gpl-thing': '1.0.0' } })
				}
			}),
			npmLicense: async () => 'GPL-3.0'
		});

		const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
		expect(byId['repo-license'].status).toBe('warn');
		expect(byId['repo-license'].message).toContain('No LICENSE');
		expect(byId['license-risk'].status).toBe('fail');
		expect(report.licenseAudit?.sellable).toBe('risk');
	});

	it('flags AGPL repo license as a sell-rights failure', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				meta: { licenseSpdx: 'AGPL-3.0' },
				entries: CLEAN_ENTRIES,
				files: CLEAN_FILES
			}),
			npmLicense: async () => 'MIT'
		});
		const license = report.checks.find((c) => c.id === 'repo-license');
		expect(license?.status).toBe('fail');
		expect(license?.message).toContain('AGPL');
	});

	it('warns on unidentified, conditional, and unknown repo licenses', async () => {
		const unidentified = await scanRepo(REF, {
			fetchers: fakeFetchers({
				meta: { licenseSpdx: 'NOASSERTION' },
				entries: CLEAN_ENTRIES,
				files: CLEAN_FILES
			}),
			npmLicense: async () => 'MIT'
		});
		const conditional = await scanRepo(REF, {
			fetchers: fakeFetchers({
				meta: { licenseSpdx: 'LGPL-3.0' },
				entries: CLEAN_ENTRIES,
				files: CLEAN_FILES
			}),
			npmLicense: async () => 'MIT'
		});
		const unknown = await scanRepo(REF, {
			fetchers: fakeFetchers({
				meta: { licenseSpdx: 'LicenseRef-Proprietary' },
				entries: CLEAN_ENTRIES,
				files: CLEAN_FILES
			}),
			npmLicense: async () => 'MIT'
		});

		expect(unidentified.checks.find((c) => c.id === 'repo-license')).toMatchObject({
			status: 'warn',
			message: expect.stringContaining('GitHub cannot identify it')
		});
		expect(conditional.checks.find((c) => c.id === 'repo-license')).toMatchObject({
			status: 'warn',
			message: expect.stringContaining('sellable with conditions')
		});
		expect(unknown.checks.find((c) => c.id === 'repo-license')).toMatchObject({
			status: 'warn',
			message: expect.stringContaining('not in our license database')
		});
	});

	it('warns when .gitignore does not cover .env and README is a stub', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: CLEAN_ENTRIES,
				files: {
					...CLEAN_FILES,
					'.gitignore': 'node_modules/\n',
					'README.md': '# Hi\n\nA thing.'
				}
			}),
			npmLicense: async () => 'MIT'
		});

		const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
		expect(byId['gitignore-env'].status).toBe('warn');
		expect(byId.readme.status).toBe('warn');
		expect(byId.readme.message).toContain('stub');
	});

	it('warns when README is missing entirely', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [
					{ path: 'package.json', type: 'blob' },
					{ path: '.gitignore', type: 'blob' },
					{ path: 'src/index.ts', type: 'blob' }
				],
				files: {
					'package.json': CLEAN_FILES['package.json'],
					'.gitignore': CLEAN_FILES['.gitignore'],
					'src/index.ts': CLEAN_FILES['src/index.ts']
				}
			}),
			npmLicense: async () => 'MIT'
		});

		const readme = report.checks.find((c) => c.id === 'readme');
		expect(readme).toMatchObject({
			status: 'warn',
			message: expect.stringContaining('No README found')
		});
	});

	it('skips dependency audit when there is no package.json', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [
					{ path: 'README.md', type: 'blob' },
					{ path: 'main.py', type: 'blob' }
				],
				files: { 'README.md': README, 'main.py': 'print("hi")' }
			}),
			npmLicense: async () => 'MIT'
		});

		expect(report.checks.find((c) => c.id === 'license-risk')).toBeUndefined();
		expect(report.checks.find((c) => c.id === 'package-scripts')).toBeUndefined();
		expect(report.licenseAudit).toBeUndefined();
		expect(report.repo?.depCount).toBeNull();
	});

	const LOCK_ENTRIES: RepoTreeEntry[] = [
		...CLEAN_ENTRIES,
		{ path: 'package-lock.json', type: 'blob' }
	];
	const LOCKFILE = JSON.stringify({
		lockfileVersion: 3,
		packages: {
			'': { name: 'launchpad' },
			'node_modules/react': { version: '18.2.0' },
			'node_modules/lodash': { version: '4.17.20' }
		}
	});

	it('fails on high-severity vulnerabilities found in the lockfile', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: LOCK_ENTRIES,
				files: { ...CLEAN_FILES, 'package-lock.json': LOCKFILE }
			}),
			npmLicense: async () => 'MIT',
			vulnAuditor: async (packages) => ({
				checked: packages.length,
				findings: [{ package: 'lodash', version: '4.17.20', vulnIds: ['GHSA-x'] }],
				worstSeverity: 'high'
			})
		});

		const vulns = report.checks.find((c) => c.id === 'dependency-vulns');
		expect(vulns?.status).toBe('fail');
		expect(vulns?.message).toContain('lodash@4.17.20 (GHSA-x)');
		expect(vulns?.message).toContain('worst: high');
		expect(report.repo?.filesSampled).toContain('package-lock.json');
	});

	it('passes the vulnerability check when the lockfile is clean', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: LOCK_ENTRIES,
				files: { ...CLEAN_FILES, 'package-lock.json': LOCKFILE }
			}),
			npmLicense: async () => 'MIT',
			vulnAuditor: async (packages) => ({
				checked: packages.length,
				findings: [],
				worstSeverity: null
			})
		});

		const vulns = report.checks.find((c) => c.id === 'dependency-vulns');
		expect(vulns?.status).toBe('pass');
		const licenseRisk = report.checks.find((c) => c.id === 'license-risk');
		expect(licenseRisk?.message).toContain('Screened 2 lockfile packages');
	});

	it('audits nested app package manifests and lockfiles in a monorepo', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [
					...CLEAN_ENTRIES,
					{ path: 'apps/web/package.json', type: 'blob' },
					{ path: 'apps/web/package-lock.json', type: 'blob' }
				],
				files: {
					...CLEAN_FILES,
					'apps/web/package.json': JSON.stringify({
						devDependencies: { vitest: '^4.0.0' },
						dependencies: { lodash: '4.17.20' }
					}),
					'apps/web/package-lock.json': JSON.stringify({
						packages: {
							'node_modules/lodash': { version: '4.17.20' }
						}
					})
				}
			}),
			npmLicense: async () => 'MIT',
			vulnAuditor: async (packages) => ({
				checked: packages.length,
				findings: [{ package: 'lodash', version: '4.17.20', vulnIds: ['GHSA-x'] }],
				worstSeverity: null
			})
		});

		expect(report.repo?.depCount).toBe(3);
		expect(report.repo?.filesSampled).toContain('apps/web/package.json');
		expect(report.repo?.filesSampled).toContain('apps/web/package-lock.json');
		const vulns = report.checks.find((c) => c.id === 'dependency-vulns');
		expect(vulns?.status).toBe('warn');
		expect(vulns?.message).toContain('severity unavailable');
	});

	it('warns on vulnerabilities with unknown severity instead of hiding them', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: LOCK_ENTRIES,
				files: { ...CLEAN_FILES, 'package-lock.json': LOCKFILE }
			}),
			npmLicense: async () => 'MIT',
			vulnAuditor: async (packages) => ({
				checked: packages.length,
				findings: [{ package: 'lodash', version: '4.17.20', vulnIds: ['GHSA-x'] }],
				worstSeverity: null
			})
		});

		const vulns = report.checks.find((c) => c.id === 'dependency-vulns');
		expect(vulns?.status).toBe('warn');
		expect(vulns?.message).toContain('severity unavailable');
	});

	it('skips the vulnerability check when OSV is unreachable or no lockfile exists', async () => {
		const unreachable = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: LOCK_ENTRIES,
				files: { ...CLEAN_FILES, 'package-lock.json': LOCKFILE }
			}),
			npmLicense: async () => 'MIT',
			vulnAuditor: async () => null
		});
		expect(unreachable.checks.find((c) => c.id === 'dependency-vulns')).toBeUndefined();

		const noLockfile = await scanRepo(REF, {
			fetchers: fakeFetchers({ entries: CLEAN_ENTRIES, files: CLEAN_FILES }),
			npmLicense: async () => 'MIT',
			vulnAuditor: async () => {
				throw new Error('should not be called without a lockfile');
			}
		});
		expect(noLockfile.checks.find((c) => c.id === 'dependency-vulns')).toBeUndefined();
	});

	it('surfaces risky transitive licenses from the lockfile in the audit', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: LOCK_ENTRIES,
				files: {
					...CLEAN_FILES,
					'package-lock.json': JSON.stringify({
						packages: {
							'node_modules/react': { version: '18.2.0' },
							'node_modules/highcharts': { version: '11.0.0' }
						}
					})
				}
			}),
			npmLicense: async () => 'MIT',
			vulnAuditor: async () => null
		});

		const flagged = report.licenseAudit?.libraries.find((l) => l.name === 'highcharts');
		expect(flagged?.sellable).toBe('conditions');
		expect(flagged?.source).toContain('transitive');
		expect(report.checks.find((c) => c.id === 'license-risk')?.message).toContain('1 flagged');
	});

	it('returns an honest blocked report when the repo is missing', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				metaError: new RepoScanError(
					'Repository acme/launchpad not found — check the URL, or the repo is private. Deploylint scans public repos only.',
					404
				)
			}),
			npmLicense: async () => null
		});

		expect(report.scanCoverage).toBe('blocked');
		expect(report.verdict).toBe('no-go');
		expect(report.verdictMessage).toContain('not found');
		expect(report.checks).toHaveLength(1);
		expect(report.checks[0].id).toBe('fetch');
	});

	const QUALITY_ENTRIES: RepoTreeEntry[] = [
		...LOCK_ENTRIES,
		{ path: '.github/workflows/ci.yml', type: 'blob' },
		{ path: 'src/index.test.ts', type: 'blob' },
		{ path: '.nvmrc', type: 'blob' },
		{ path: 'tsconfig.json', type: 'blob' }
	];

	const QUALITY_FILES: Record<string, string> = {
		...CLEAN_FILES,
		'package.json': JSON.stringify({
			dependencies: { react: '^18.0.0' },
			engines: { node: '>=20' },
			scripts: { test: 'vitest run' }
		}),
		'package-lock.json': LOCKFILE,
		'.github/workflows/ci.yml': 'name: CI\n',
		'src/index.test.ts':
			'import { expect, it } from "vitest";\nit("works", () => expect(1).toBe(1));',
		'.nvmrc': '20\n',
		'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } })
	};

	it('passes repo quality checks when CI, tests, lockfile, node pin, and strict TS are present', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({ entries: QUALITY_ENTRIES, files: QUALITY_FILES }),
			npmLicense: async () => 'MIT',
			vulnAuditor: async () => null
		});

		const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
		expect(byId['ci-config'].status).toBe('pass');
		expect(byId['tests-present'].status).toBe('pass');
		expect(byId['lockfile-committed'].status).toBe('pass');
		expect(byId['node-version-pinned'].status).toBe('pass');
		expect(byId['ts-strict'].status).toBe('pass');
		expect(report.repo?.filesSampled).toContain('tsconfig.json');
	});

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
		expect(report.checks.map((check) => check.id)).toHaveLength(
			new Set(report.checks.map((check) => check.id)).size
		);
		expect(report.repo?.filesSampled).toContain('wrangler.jsonc');
	});

	it('surfaces billing readiness findings from sampled source files', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [
					...CLEAN_ENTRIES,
					{ path: 'src/routes/api/webhooks/stripe/+server.ts', type: 'blob' }
				],
				files: {
					...CLEAN_FILES,
					'package.json': JSON.stringify({
						dependencies: { stripe: '^20.0.0' },
						scripts: { test: 'vitest run', build: 'vite build' }
					}),
					'src/routes/api/webhooks/stripe/+server.ts': `
export async function POST({ request }) {
  const event = await request.json();
  if (event.type === 'checkout.session.completed') return new Response('ok');
}
`
				}
			}),
			npmLicense: async () => 'MIT'
		});

		const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
		expect(byId['webhook-signature-missing']).toMatchObject({
			status: 'fail',
			category: 'payments',
			priority: 'p0'
		});
		expect(byId['billing-portal']).toMatchObject({
			status: 'warn',
			category: 'payments'
		});
		expect(report.repo?.filesSampled).toContain('src/routes/api/webhooks/stripe/+server.ts');
	});

	it('loads high-signal payment files when judging repo revenue readiness', async () => {
		const paymentPaths = [
			'src/routes/api/checkout/+server.ts',
			'src/routes/api/webhooks/stripe/+server.ts',
			'src/lib/entitlements.ts',
			'src/routes/account/billing/+server.ts'
		];
		const highSignalSamples = [
			'src/config/app.ts',
			'src/config/auth.ts',
			'src/config/db.ts',
			'src/config/email.ts',
			'src/config/env.ts',
			'src/config/firebase.ts',
			'src/config/secrets.ts',
			'src/config/settings.ts'
		];
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [
					...CLEAN_ENTRIES,
					...highSignalSamples.map((path) => ({ path, type: 'blob' as const })),
					...paymentPaths.map((path) => ({ path, type: 'blob' as const }))
				],
				files: {
					...CLEAN_FILES,
					'package.json': JSON.stringify({
						dependencies: { stripe: '^20.0.0' },
						scripts: { test: 'vitest run', build: 'vite build' }
					}),
					...Object.fromEntries(
						highSignalSamples.map((path) => [path, 'export const value = true;'])
					),
					'src/routes/api/checkout/+server.ts': `
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function POST() {
  await stripe.checkout.sessions.create({ mode: 'subscription' });
  return new Response('ok');
}
`,
					'src/routes/api/webhooks/stripe/+server.ts': `
import { grantAccess, revokeAccess } from '$lib/entitlements';

export async function POST({ request, locals }) {
  const signature = request.headers.get('stripe-signature');
  const raw = await request.text();
  const event = stripe.webhooks.constructEvent(raw, signature, locals.env.STRIPE_WEBHOOK_SECRET);

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await grantAccess(event.data.object.customer);
      break;
    case 'checkout.session.async_payment_failed':
    case 'invoice.payment_failed':
    case 'customer.subscription.deleted':
      await revokeAccess(event.data.object.customer);
      break;
  }

  return new Response('ok');
}
`,
					'src/lib/entitlements.ts': `
export async function grantAccess(customer: string) {
  return customer;
}

export async function revokeAccess(customer: string) {
  return customer;
}
`,
					'src/routes/account/billing/+server.ts': `
export async function POST() {
  await stripe.billingPortal.sessions.create({ customer });
  return new Response('ok');
}
`
				}
			}),
			npmLicense: async () => 'MIT'
		});

		const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
		for (const id of [
			'checkout-server-owned',
			'webhook-signature-missing',
			'webhook-event-coverage',
			'entitlement-fulfillment',
			'billing-portal',
			'payment-env-safety'
		]) {
			expect(byId[id]).toMatchObject({ status: 'pass', category: 'payments' });
		}
		for (const path of paymentPaths) {
			expect(report.repo?.filesSampled).toContain(path);
		}
	});

	it('fetches payment files once when the generic sampler also selects them', async () => {
		const paymentPath = 'src/routes/api/webhooks/stripe/+server.ts';
		const fetchedPaths: string[] = [];
		await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [...CLEAN_ENTRIES, { path: paymentPath, type: 'blob' }],
				files: {
					...CLEAN_FILES,
					'package.json': JSON.stringify({
						dependencies: { stripe: '^20.0.0' },
						scripts: { test: 'vitest run', build: 'vite build' }
					}),
					[paymentPath]: `
const event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
if (event.type === 'checkout.session.completed') return new Response('ok');
`
				},
				onGetFile: (path) => fetchedPaths.push(path)
			}),
			npmLicense: async () => 'MIT'
		});

		expect(fetchedPaths.filter((path) => path === paymentPath)).toHaveLength(1);
	});

	it('warns on missing repo quality signals for a minimal repo', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({ entries: CLEAN_ENTRIES, files: CLEAN_FILES }),
			npmLicense: async () => 'MIT'
		});

		const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
		expect(byId['ci-config'].status).toBe('warn');
		expect(byId['tests-present'].status).toBe('warn');
		expect(byId['test-depth'].status).toBe('warn');
		expect(byId['lockfile-committed'].status).toBe('warn');
		expect(byId['node-version-pinned'].status).toBe('warn');
		expect(byId['ts-strict']).toBeUndefined();
	});

	it('surfaces a repo that only looks tested but is unsafe to launch', async () => {
		const entries: RepoTreeEntry[] = [
			{ path: 'package.json', type: 'blob' },
			{ path: 'package-lock.json', type: 'blob' },
			{ path: 'README.md', type: 'blob' },
			{ path: '.env.production', type: 'blob' },
			{ path: 'tsconfig.json', type: 'blob' },
			{ path: 'wrangler.jsonc', type: 'blob' },
			{ path: 'Dockerfile', type: 'blob' },
			{ path: '.github/workflows/ci.yml', type: 'blob' },
			{ path: 'src/smoke.test.ts', type: 'blob' },
			{ path: 'src/routes/api/webhooks/stripe/+server.ts', type: 'blob' },
			{ path: 'src/lib/server/stripe.ts', type: 'blob' }
		];
		const files: Record<string, string> = {
			'package.json': JSON.stringify({
				packageManager: 'pnpm@10.0.0',
				dependencies: { stripe: '^20.0.0', lodash: '4.17.20' },
				devDependencies: { typescript: '^5.0.0', '@sveltejs/kit': '^2.0.0' },
				scripts: {
					lint: 'true',
					test: 'echo "no tests" && exit 0',
					build: 'true'
				}
			}),
			'package-lock.json': JSON.stringify({
				lockfileVersion: 3,
				packages: {
					'node_modules/lodash': { version: '4.17.20' },
					'node_modules/stripe': { version: '20.0.0' }
				}
			}),
			'README.md': '# App\n\nTODO',
			'.env.production': `STRIPE_SECRET_KEY=sk_live_${'a'.repeat(24)}\n`,
			'tsconfig.json': JSON.stringify({ compilerOptions: { strict: false } }),
			'wrangler.jsonc': '{ "compatibility_date": "2025-01-01" }',
			Dockerfile: 'FROM node:22\nCOPY .env .env\nRUN npm ci\n',
			'.github/workflows/ci.yml': `
on: pull_request_target
permissions: write-all
jobs:
  verify:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
          repository: \${{ github.event.pull_request.head.repo.full_name }}
          allow-unsafe-pr-checkout: true
      - uses: acme/deploy@main
      # - run: npm run lint
      # - run: npm test
      # - run: npm run build
      - run: echo "\${{ github.event.pull_request.title }}"
`,
			'src/smoke.test.ts':
				'import { expect, it } from "vitest";\nit("works", () => expect(1).toBe(1));',
			'src/routes/api/webhooks/stripe/+server.ts': `
export async function POST({ request }) {
  const event = await request.json();
  if (event.type === 'checkout.session.completed') return new Response('ok');
}
`,
			'src/lib/server/stripe.ts': `const stripe = new Stripe('sk_live_${'b'.repeat(24)}');`
		};

		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({ entries, files }),
			npmLicense: async () => 'MIT',
			vulnAuditor: async (packages) => ({
				checked: packages.length,
				findings: [{ package: 'lodash', version: '4.17.20', vulnIds: ['GHSA-test'] }],
				worstSeverity: 'high'
			})
		});

		const byId = Object.fromEntries(report.checks.map((check) => [check.id, check]));
		const expectedStatuses = {
			'env-committed': 'fail',
			secrets: 'fail',
			'gitignore-env': 'warn',
			readme: 'warn',
			'tests-present': 'pass',
			'test-depth': 'warn',
			'package-scripts': 'warn',
			'lint-script': 'warn',
			'build-script': 'warn',
			'typecheck-script': 'warn',
			'svelte-check': 'warn',
			'package-manager-pinned': 'warn',
			'dependency-vulns': 'fail',
			'ci-runs-quality-gates': 'warn',
			'workflow-permissions': 'warn',
			'workflow-pull-request-target': 'fail',
			'workflow-action-pinning': 'warn',
			'workflow-immutable-action-pins': 'warn',
			'codeql-code-scanning': 'warn',
			'dependency-review-action': 'warn',
			'dependabot-config': 'warn',
			'webhook-signature-missing': 'fail',
			'webhook-event-coverage': 'warn',
			'webhook-idempotency': 'warn',
			'entitlement-fulfillment': 'warn',
			'billing-portal': 'warn',
			'payment-env-safety': 'fail',
			'wrangler-compat-date': 'warn',
			'docker-env-copy': 'fail',
			'ts-strict': 'warn'
		} as const;

		for (const [id, status] of Object.entries(expectedStatuses)) {
			expect(byId[id]?.status).toBe(status);
		}
		expect(byId['env-committed']?.message).toContain('Stripe live secret key');
		expect(byId['workflow-pull-request-target']?.priority).toBe('p0');
		expect(byId['payment-env-safety']?.priority).toBe('p0');
		expect(report.verdict).toBe('no-go');
	});

	it('ts-strict warns but never fails even when strict is disabled', async () => {
		const report = await scanRepo(REF, {
			fetchers: fakeFetchers({
				entries: [...CLEAN_ENTRIES, { path: 'tsconfig.json', type: 'blob' }],
				files: {
					...CLEAN_FILES,
					'tsconfig.json': JSON.stringify({ compilerOptions: { strict: false } })
				}
			}),
			npmLicense: async () => 'MIT'
		});

		const tsStrict = report.checks.find((c) => c.id === 'ts-strict');
		expect(tsStrict?.status).toBe('warn');
		expect(report.checks.filter((c) => c.id === 'ts-strict' && c.status === 'fail')).toHaveLength(
			0
		);
		expect(report.verdict).not.toBe('no-go');
	});
});
