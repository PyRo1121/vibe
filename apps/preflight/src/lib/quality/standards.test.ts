import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	assertQualityStandards,
	CRITICAL_COVERAGE_THRESHOLDS,
	ENTERPRISE_COVERAGE_MINIMUMS,
	inspectQualityStandards
} from './standards';

function writeFixtureFile(path: string, content: string) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
}

describe('quality standards guard', () => {
	it('keeps lint, format, coverage, build, e2e, and smoke gates enforced', () => {
		const report = inspectQualityStandards();

		expect(report.failures).toEqual([]);
		expect(assertQualityStandards().failures).toEqual([]);
		for (const [metric, minimum] of Object.entries(ENTERPRISE_COVERAGE_MINIMUMS)) {
			expect(
				report.coverageThresholds[metric as keyof typeof ENTERPRISE_COVERAGE_MINIMUMS]
			).toBeGreaterThanOrEqual(minimum);
		}
		expect(report.checked).toEqual(
			expect.arrayContaining([
				'preflight scripts run oxfmt, oxlint, and type-aware oxlint with zero-warning lint',
				'preflight verify runs standards, typecheck, lint, type-aware lint, coverage, and build',
				'preflight-mcp verify runs typecheck, lint, type-aware lint, coverage, and build',
				'deploylint-shared verify runs typecheck, lint, type-aware lint, coverage, and syntax checks',
				'root dependency audit fails on any known vulnerability',
				'root deploylint CI verify runs audit, shared, preflight, mcp, Playwright install, and e2e',
				'root deploylint local verify skips network-heavy CI-only gates',
				'root dead-code gate runs knip against Deploylint workspaces',
				'root deploylint ship verify adds production smoke',
				'oxlint config enables correctness, suspicious, TypeScript, Vitest, Promise, and Unicorn guards',
				'oxfmt config enforces deterministic imports, Tailwind sorting, Svelte formatting, and LF endings',
				'vitest coverage thresholds meet enterprise minimums',
				'vitest scoped coverage thresholds protect critical Deploylint folders',
				'vitest coverage includes SvelteKit server route entrypoints',
				'preflight-mcp coverage thresholds meet enterprise minimums',
				'deploylint-shared coverage thresholds meet enterprise minimums',
				'GitHub workflows enforce canonical deploylint CI and MCP dogfood gates',
				'GitHub workflows declare least-privilege token permissions',
				'Playwright CI captures screenshots, videos, traces, junit, and html failure reports',
				'Vitest CI captures junit test-result artifacts for preflight, MCP, and shared packages'
			])
		);
	});

	it('reports weak standards in an isolated fixture', () => {
		const root = mkdtempSync(join(tmpdir(), 'deploylint-quality-'));

		try {
			writeFixtureFile(
				join(root, 'package.json'),
				JSON.stringify({
					scripts: {
						'verify:deploylint:ci': 'npm run verify -w preflight',
						'verify:deploylint:local': 'npm run audit:security && npm run verify -w preflight',
						'verify:deploylint': 'npm run verify -w preflight'
					},
					devDependencies: {}
				})
			);
			writeFixtureFile(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }));
			writeFixtureFile(join(root, '.nvmrc'), '24\n');
			writeFixtureFile(
				join(root, 'apps/preflight/package.json'),
				JSON.stringify({
					scripts: {
						verify: 'npm run check'
					},
					devDependencies: {}
				})
			);
			writeFixtureFile(
				join(root, 'apps/preflight-mcp/package.json'),
				JSON.stringify({
					scripts: {
						verify: 'npm run check'
					},
					devDependencies: {}
				})
			);
			writeFixtureFile(
				join(root, 'apps/deploylint-shared/package.json'),
				JSON.stringify({
					scripts: {
						lint: 'oxfmt --check .'
					},
					devDependencies: {}
				})
			);
			writeFixtureFile(
				join(root, 'apps/deploylint-shared/tsconfig.json'),
				JSON.stringify({
					compilerOptions: {
						strict: false
					}
				})
			);
			writeFixtureFile(
				join(root, 'apps/deploylint-shared/vitest.config.ts'),
				`export default {
					test: {
						coverage: {
							thresholds: {
								statements: 80,
								lines: 80,
								functions: 80,
								branches: 80
							}
						}
					}
				};`
			);
			writeFixtureFile(
				join(root, '.oxlintrc.jsonc'),
				JSON.stringify({
					categories: {
						correctness: 'warn',
						suspicious: 'warn'
					},
					options: {
						reportUnusedDisableDirectives: 'warn',
						denyWarnings: false,
						maxWarnings: 10
					},
					plugins: ['typescript'],
					rules: {
						'no-debugger': 'warn',
						'typescript/no-explicit-any': 'off',
						'typescript/no-floating-promises': 'warn',
						'vitest/no-focused-tests': 'off',
						'vitest/expect-expect': 'off'
					}
				})
			);
			writeFixtureFile(
				join(root, '.oxfmtrc.jsonc'),
				JSON.stringify({
					sortImports: false,
					sortTailwindcss: false,
					svelte: false,
					endOfLine: 'crlf',
					useTabs: false
				})
			);
			writeFixtureFile(
				join(root, 'knip.deploylint.jsonc'),
				JSON.stringify({
					workspaces: {}
				})
			);
			writeFixtureFile(
				join(root, 'apps/preflight/vite.config.ts'),
				`const coverageMetric = 'statements';
				export default {
					test: {
						coverage: {
							thresholds: {
								[coverageMetric]: 70,
								lines: 70,
								functions: 70,
								branches: 70
							},
							'src/lib/billing/**.ts': {
								statements: 80,
								lines: 80,
								functions: 80,
								branches: 80
							},
							'src/routes/api/**/+server.ts': {
								statements: 80,
								lines: 80,
								functions: 80,
								branches: 80
							}
						}
					}
				};`
			);
			writeFixtureFile(
				join(root, 'apps/preflight-mcp/vite.config.ts'),
				`export default {
					test: {
						coverage: {
							thresholds: {
								statements: 90,
								lines: 90,
								functions: 90,
								branches: 80
							}
						}
					}
				};`
			);
			writeFixtureFile(
				join(root, 'apps/preflight/playwright.config.ts'),
				`export default {
					reporter: 'list',
					use: {
						trace: 'off'
					}
				};`
			);
			writeFixtureFile(join(root, '.github/workflows/preflight-gate.yml'), 'npm test');
			writeFixtureFile(join(root, '.github/workflows/deploylint-dogfood.yml'), 'npm test');

			const report = inspectQualityStandards(root);

			expect(report.checked).toContain('expected quality config files exist');
			expect(report.failures).toEqual(
				expect.arrayContaining([
					'preflight scripts run oxfmt, oxlint, and type-aware oxlint with zero-warning lint',
					'preflight verify runs standards, typecheck, lint, type-aware lint, coverage, and build',
					'preflight-mcp verify runs typecheck, lint, type-aware lint, coverage, and build',
					'deploylint-shared verify runs typecheck, lint, type-aware lint, coverage, and syntax checks',
					'root dependency audit fails on any known vulnerability',
					'root deploylint CI verify runs audit, shared, preflight, mcp, Playwright install, and e2e',
					'root deploylint local verify skips network-heavy CI-only gates',
					'root dead-code gate runs knip against Deploylint workspaces',
					'root deploylint ship verify adds production smoke',
					'oxlint config enables correctness, suspicious, TypeScript, Vitest, Promise, and Unicorn guards',
					'oxfmt config enforces deterministic imports, Tailwind sorting, Svelte formatting, and LF endings',
					'vitest coverage thresholds meet enterprise minimums',
					'vitest scoped coverage thresholds protect critical Deploylint folders',
					'vitest coverage includes SvelteKit server route entrypoints',
					'preflight-mcp coverage thresholds meet enterprise minimums',
					'deploylint-shared coverage thresholds meet enterprise minimums',
					'GitHub workflows enforce canonical deploylint CI and MCP dogfood gates',
					'GitHub workflows declare least-privilege token permissions',
					'Playwright CI captures screenshots, videos, traces, junit, and html failure reports',
					'Vitest CI captures junit test-result artifacts for preflight, MCP, and shared packages',
					'quality standards script is runnable from npm'
				])
			);
			expect(() => assertQualityStandards(root)).toThrow(/Quality standards failed/);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	it('documents the critical folder coverage floors', () => {
		expect(CRITICAL_COVERAGE_THRESHOLDS).toEqual({
			'src/lib/billing/**.ts': {
				statements: 94,
				lines: 96,
				functions: 100,
				branches: 92
			},
			'src/lib/ci/**.ts': {
				statements: 95,
				lines: 97,
				functions: 100,
				branches: 84
			},
			'src/lib/monitoring/**.ts': {
				statements: 95,
				lines: 97,
				functions: 100,
				branches: 91
			},
			'src/lib/scan/repo/**.ts': {
				statements: 97,
				lines: 98,
				functions: 97,
				branches: 90
			},
			'src/lib/server/**.ts': {
				statements: 97,
				lines: 98,
				functions: 97,
				branches: 92
			},
			'src/routes/api/**/+server.ts': {
				statements: 95,
				lines: 95,
				functions: 100,
				branches: 90
			}
		});
	});

	it('reports missing standards files without throwing raw file errors', () => {
		const root = mkdtempSync(join(tmpdir(), 'deploylint-quality-missing-'));

		try {
			const report = inspectQualityStandards(root);

			expect(report.checked).toEqual([]);
			expect(report.failures).toEqual(['expected quality config files exist']);
			expect(report.coverageThresholds).toEqual({
				statements: 0,
				lines: 0,
				functions: 0,
				branches: 0
			});
			expect(() => assertQualityStandards(root)).toThrow(/expected quality config files exist/);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
