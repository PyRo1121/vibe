import { describe, expect, it } from 'vitest';
import {
	findCiConfig,
	findLockfile,
	hasTests,
	nodeVersionPinned,
	parseTsconfigStrict
} from '$lib/scan/repo/quality';
import type { RepoTreeEntry } from '$lib/scan/repo/github';

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

	it('detects a real test script in package.json', () => {
		const pkg = JSON.stringify({ scripts: { test: 'vitest run' } });
		expect(hasTests([blob('src/index.ts')], pkg)).toBe(true);
	});

	it('ignores placeholder test scripts', () => {
		const pkg = JSON.stringify({ scripts: { test: 'echo "no tests"' } });
		expect(hasTests([blob('src/index.ts')], pkg)).toBe(false);
	});

	it('returns false with no tests and no script', () => {
		expect(hasTests([blob('src/index.ts')], JSON.stringify({ scripts: {} }))).toBe(false);
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
		expect(nodeVersionPinned([blob('src/index.ts')], JSON.stringify({ name: 'app' }))).toBe(
			false
		);
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
