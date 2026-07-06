import type { RepoTreeEntry } from '$lib/scan/repo/github';
import {
	assessTestSuiteDepth,
	findCiConfig,
	findLockfile,
	findTestFilePaths,
	hasTests,
	nodeVersionPinned,
	parseTsconfigStrict
} from '$lib/scan/repo/quality';
import { describe, expect, it } from 'vitest';

const blob = (path: string): RepoTreeEntry => ({ path, type: 'blob' });

describe('findCiConfig', () => {
	it('finds GitHub Actions workflows and other CI configs', () => {
		const entries = [
			blob('src/index.ts'),
			blob('.github/workflows/ci.yml'),
			blob('.gitlab-ci.yml')
		];
		expect(findCiConfig(entries)).toBe('.github/workflows/ci.yml');
	});

	it('returns null when no CI config exists', () => {
		expect(findCiConfig([blob('README.md'), blob('src/index.ts')])).toBeNull();
	});
});

describe('hasTests', () => {
	it('detects test files and directories', () => {
		const entries = [blob('src/utils.test.ts'), blob('tests/smoke.spec.js')];
		expect(hasTests(entries, null)).toBe(true);
	});

	it('detects common non-JavaScript test layouts', () => {
		expect(
			hasTests(
				[blob('pkg/service_test.go'), blob('tests/test_billing.py'), blob('tests/api.rs')],
				null
			)
		).toBe(true);
		expect(
			findTestFilePaths([blob('node_modules/pkg/foo.test.ts'), blob('src/app_test.go')])
		).toEqual(['src/app_test.go']);
	});

	it('detects a real test script in package.json', () => {
		const pkg = JSON.stringify({ scripts: { test: 'vitest run' } });
		expect(hasTests([blob('src/index.ts')], pkg)).toBe(true);
	});

	it('ignores placeholder test scripts', () => {
		const pkg = JSON.stringify({ scripts: { test: 'echo "no tests"' } });
		expect(hasTests([blob('src/index.ts')], pkg)).toBe(false);
	});

	it('ignores scripts that do not actually run tests', () => {
		expect(hasTests([blob('src/index.ts')], JSON.stringify({ scripts: { test: 'echo ok' } }))).toBe(
			false
		);
		expect(
			hasTests([blob('src/index.ts')], JSON.stringify({ scripts: { test: 'npm run lint' } }))
		).toBe(false);
		expect(
			hasTests(
				[blob('src/index.ts')],
				JSON.stringify({ scripts: { test: 'vitest run --passWithNoTests' } })
			)
		).toBe(false);
		expect(
			hasTests([blob('src/index.ts')], JSON.stringify({ scripts: { test: 'run test' } }))
		).toBe(false);
	});

	it('follows package script indirection to a real test runner', () => {
		const pkg = JSON.stringify({
			scripts: {
				test: 'npm run test:unit',
				'test:unit': 'vitest run'
			}
		});

		expect(hasTests([blob('src/index.ts')], pkg)).toBe(true);
	});

	it('returns false with no tests and no script', () => {
		expect(hasTests([blob('src/index.ts')], JSON.stringify({ scripts: {} }))).toBe(false);
	});
});

describe('assessTestSuiteDepth', () => {
	it('warns when a repo only has trivial test-shaped evidence', () => {
		const entries = [blob('package.json'), blob('src/smoke.test.ts')];
		const pkg = JSON.stringify({
			scripts: {
				test: 'vitest run'
			}
		});

		const audit = assessTestSuiteDepth(entries, pkg, [
			{
				path: 'src/smoke.test.ts',
				text: 'import { expect, it } from "vitest"; it("works", () => expect(1).toBe(1));'
			}
		]);

		expect(audit.status).toBe('warn');
		expect(audit.message).toContain('no sampled test file showed substantive assertions');
		expect(audit.message).toContain('no coverage command or threshold');
	});

	it('passes when tests show assertions, coverage, and breadth', () => {
		const entries = [
			blob('package.json'),
			blob('src/lib/billing.test.ts'),
			blob('src/routes/api/webhook.integration.test.ts'),
			blob('e2e/checkout.spec.ts')
		];
		const pkg = JSON.stringify({
			scripts: {
				test: 'vitest run --coverage',
				'test:e2e': 'playwright test'
			}
		});

		const audit = assessTestSuiteDepth(
			entries,
			pkg,
			[
				{
					path: 'src/lib/billing.test.ts',
					text: `
import { expect, it } from "vitest";
import { calculatePlanAccess } from "./billing";
it("keeps canceled subscriptions locked", () => {
  expect(calculatePlanAccess({ status: "canceled", seats: 3 })).toEqual({ active: false, seats: 0 });
});
`
				},
				{
					path: 'src/routes/api/webhook.integration.test.ts',
					text: `
import { expect, it } from "vitest";
import { POST } from "./+server";
it("rejects unsigned payment webhooks", async () => {
  const response = await POST({ request: new Request("https://app.test/webhook", { method: "POST" }) });
  expect(response.status).toBe(400);
});
`
				},
				{
					path: 'e2e/checkout.spec.ts',
					text: `
import { expect, test } from "@playwright/test";
test("paid checkout reaches the hosted provider", async ({ page }) => {
  await page.goto("/pricing");
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect(page).toHaveURL(/checkout/);
});
`
				}
			],
			[{ path: '.github/workflows/ci.yml', text: 'npm run test -- --coverage\nnpm run test:e2e' }]
		);

		expect(audit.status).toBe('pass');
		expect(audit.message).toContain('coverage signal');
		expect(audit.message).toContain('unit/integration/e2e');
	});
});

describe('findLockfile', () => {
	it('finds root lockfiles', () => {
		expect(findLockfile([blob('package-lock.json'), blob('pnpm-lock.yaml')])).toBe(
			'package-lock.json'
		);
		expect(findLockfile([blob('pnpm-lock.yaml')])).toBe('pnpm-lock.yaml');
	});

	it('ignores nested lockfiles', () => {
		expect(findLockfile([blob('apps/web/package-lock.json')])).toBeNull();
	});
});

describe('nodeVersionPinned', () => {
	it('accepts engines.node in package.json', () => {
		const pkg = JSON.stringify({ engines: { node: '>=20' } });
		expect(nodeVersionPinned([], pkg)).toBe(true);
	});

	it('accepts .nvmrc or .node-version at repo root', () => {
		expect(nodeVersionPinned([blob('.nvmrc')], null)).toBe(true);
		expect(nodeVersionPinned([blob('.node-version')], null)).toBe(true);
	});

	it('returns false when nothing pins Node', () => {
		expect(nodeVersionPinned([blob('src/index.ts')], JSON.stringify({ name: 'app' }))).toBe(false);
	});
});

describe('parseTsconfigStrict', () => {
	it('reads strict mode from tsconfig.json', () => {
		expect(parseTsconfigStrict(JSON.stringify({ compilerOptions: { strict: true } }))).toEqual({
			valid: true,
			strict: true
		});
		expect(parseTsconfigStrict(JSON.stringify({ compilerOptions: { strict: false } }))).toEqual({
			valid: true,
			strict: false
		});
	});

	it('handles missing or invalid tsconfig', () => {
		expect(parseTsconfigStrict(null)).toEqual({ valid: false, strict: null });
		expect(parseTsconfigStrict('{broken')).toEqual({ valid: false, strict: null });
	});
});
