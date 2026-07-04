import { describe, expect, it } from 'vitest';
import { MAX_LOCK_PACKAGES, parsePackageLock, screenTransitiveLicenses } from './lockfile';

describe('parsePackageLock', () => {
	it('parses v3 lockfiles with scoped and nested packages', () => {
		const lock = JSON.stringify({
			lockfileVersion: 3,
			packages: {
				'': { name: 'my-app', version: '1.0.0' },
				'node_modules/react': { version: '18.2.0' },
				'node_modules/@sveltejs/kit': { version: '2.5.0' },
				'node_modules/foo/node_modules/bar': { version: '0.1.0' }
			}
		});
		expect(parsePackageLock(lock)).toEqual([
			{ name: 'react', version: '18.2.0' },
			{ name: '@sveltejs/kit', version: '2.5.0' },
			{ name: 'bar', version: '0.1.0' }
		]);
	});

	it('parses legacy v1 lockfiles with nested dependencies', () => {
		const lock = JSON.stringify({
			lockfileVersion: 1,
			dependencies: {
				express: {
					version: '4.18.0',
					dependencies: { accepts: { version: '1.3.8' } }
				}
			}
		});
		expect(parsePackageLock(lock)).toEqual([
			{ name: 'express', version: '4.18.0' },
			{ name: 'accepts', version: '1.3.8' }
		]);
	});

	it('dedupes identical name@version pairs', () => {
		const lock = JSON.stringify({
			packages: {
				'node_modules/lodash': { version: '4.17.21' },
				'node_modules/a/node_modules/lodash': { version: '4.17.21' }
			}
		});
		expect(parsePackageLock(lock)).toHaveLength(1);
	});

	it('returns [] on garbage, null, and workspace-only entries', () => {
		expect(parsePackageLock(null)).toEqual([]);
		expect(parsePackageLock('not json')).toEqual([]);
		expect(
			parsePackageLock(JSON.stringify({ packages: { 'packages/app': { version: '1.0.0' } } }))
		).toEqual([]);
	});

	it('caps output on giant lockfiles', () => {
		const packages: Record<string, { version: string }> = {};
		for (let i = 0; i < MAX_LOCK_PACKAGES + 100; i += 1) {
			packages[`node_modules/pkg-${i}`] = { version: '1.0.0' };
		}
		expect(parsePackageLock(JSON.stringify({ packages }))).toHaveLength(MAX_LOCK_PACKAGES);
	});
});

describe('screenTransitiveLicenses', () => {
	it('flags curated risky licenses and ignores permissive/unknown packages', () => {
		const flagged = screenTransitiveLicenses([
			{ name: 'react', version: '18.2.0' },
			{ name: 'some-random-package', version: '1.0.0' },
			{ name: 'highcharts', version: '11.0.0' }
		]);
		// react is curated-permissive, random package is unknown — only the
		// commercially-licensed highcharts is flagged.
		expect(flagged).toHaveLength(1);
		expect(flagged[0]).toMatchObject({
			name: 'highcharts',
			sellable: 'conditions',
			source: 'package-lock.json (transitive)'
		});
	});
});
