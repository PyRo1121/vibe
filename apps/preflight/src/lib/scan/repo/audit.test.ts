import {
	findCommittedEnvFiles,
	selectSourceSamples,
	findRootFile,
	parsePackageJson,
	auditNpmDependencies,
	npmRegistryLicenseFetcher
} from '$lib/scan/repo/audit';
import type { RepoTreeEntry } from '$lib/scan/repo/github';
import { afterEach, describe, expect, it, vi } from 'vitest';

const blob = (path: string, size?: number): RepoTreeEntry => ({ path, type: 'blob', size });
type NpmRegistryResponse = {
	ok: boolean;
	json: () => Promise<{ license?: string | { type?: string } }>;
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('findCommittedEnvFiles', () => {
	it('finds committed env files but not examples or vendored copies', () => {
		const entries = [
			blob('.env'),
			blob('.env.production'),
			blob('.env.example'),
			blob('.env.sample'),
			blob('apps/web/.env.local'),
			blob('node_modules/pkg/.env'),
			blob('src/index.ts')
		];
		expect(findCommittedEnvFiles(entries)).toEqual([
			'.env',
			'.env.production',
			'apps/web/.env.local'
		]);
	});
});

describe('selectSourceSamples', () => {
	it('prefers config-ish files and skips lockfiles, vendored, and minified code', () => {
		const entries = [
			blob('src/deep/nested/module/util.ts'),
			blob('src/config.ts'),
			blob('package-lock.json'),
			blob('dist/bundle.js'),
			blob('vendor/lib.js'),
			blob('assets/app.min.js'),
			blob('src/firebase-init.js'),
			blob('big.ts', 5_000_000)
		];
		const picked = selectSourceSamples(entries);
		expect(picked[0]).toBe('src/config.ts');
		expect(picked).toContain('src/firebase-init.js');
		expect(picked).toContain('src/deep/nested/module/util.ts');
		expect(picked).not.toContain('package-lock.json');
		expect(picked).not.toContain('dist/bundle.js');
		expect(picked).not.toContain('vendor/lib.js');
		expect(picked).not.toContain('assets/app.min.js');
		expect(picked).not.toContain('big.ts');
	});

	it('caps the sample size', () => {
		const entries = Array.from({ length: 30 }, (_, i) => blob(`src/file${i}.ts`));
		expect(selectSourceSamples(entries).length).toBeLessThanOrEqual(8);
	});
});

describe('findRootFile', () => {
	it('matches root files only', () => {
		const entries = [blob('docs/README.md'), blob('README.md'), blob('src/package.json')];
		expect(findRootFile(entries, /^readme(\.(md|markdown|txt|rst))?$/i)).toBe('README.md');
		expect(findRootFile(entries, /^package\.json$/)).toBeNull();
	});
});

describe('parsePackageJson', () => {
	it('extracts production and secondary dependency sections', () => {
		const { dependencies, valid } = parsePackageJson(
			JSON.stringify({
				dependencies: { react: '^18.0.0' },
				devDependencies: { vitest: '^1.0.0' },
				optionalDependencies: { sharp: '^0.33.0' },
				peerDependencies: { svelte: '^5.0.0' }
			})
		);
		expect(valid).toBe(true);
		expect(dependencies).toEqual({
			react: '^18.0.0',
			vitest: '^1.0.0',
			sharp: '^0.33.0',
			svelte: '^5.0.0'
		});
	});

	it('handles missing or broken files', () => {
		expect(parsePackageJson(null).valid).toBe(false);
		expect(parsePackageJson('{oops').valid).toBe(false);
	});

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
});

describe('auditNpmDependencies', () => {
	it('uses curated facts without a registry call, and classifies registry licenses', async () => {
		const lookups: string[] = [];
		const fetchLicense = async (pkg: string) => {
			lookups.push(pkg);
			if (pkg === 'some-gpl-lib') return 'GPL-3.0';
			if (pkg === 'tiny-util') return 'MIT';
			return null;
		};

		const { libraries, audited, total } = await auditNpmDependencies(
			{ react: '^18.2.0', 'some-gpl-lib': '1.0.0', 'tiny-util': '~2.1.0', mysterious: '0.0.1' },
			fetchLicense
		);

		expect(total).toBe(4);
		expect(audited).toBe(4);
		// react is curated — no registry lookup.
		expect(lookups).not.toContain('react');

		const byName = Object.fromEntries(libraries.map((l) => [l.name, l]));
		expect(byName.react.sellable).toBe('yes');
		expect(byName.react.version).toBe('18.2.0');
		expect(byName['some-gpl-lib'].sellable).toBe('risk');
		expect(byName['tiny-util'].sellable).toBe('yes');
		expect(byName.mysterious.sellable).toBe('unknown');
	});

	it('caps registry lookups at the budget', async () => {
		const deps = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`pkg-${i}`, '1.0.0']));
		const { audited, total } = await auditNpmDependencies(deps, async () => 'MIT');
		expect(total).toBe(30);
		expect(audited).toBe(20);
	});
});

describe('npmRegistryLicenseFetcher', () => {
	it('reads string and object-shaped license values from npm metadata', async () => {
		const fetchMock = vi.fn<(url: string) => Promise<NpmRegistryResponse>>(async (url) => ({
			ok: true,
			json: async () =>
				url.includes('object-license') ? { license: { type: 'Apache-2.0' } } : { license: 'MIT' }
		}));
		vi.stubGlobal('fetch', fetchMock);

		const fetchLicense = npmRegistryLicenseFetcher();

		await expect(fetchLicense('tiny-util')).resolves.toBe('MIT');
		await expect(fetchLicense('object-license')).resolves.toBe('Apache-2.0');
	});

	it('encodes scoped package names and safely handles registry misses or failures', async () => {
		const fetchMock = vi.fn<(url: string) => Promise<NpmRegistryResponse>>(async (url) => {
			if (url.includes('%40scope%2Fpkg')) {
				return { ok: true, json: async () => ({}) };
			}
			if (url.includes('missing')) {
				return { ok: false, json: async () => ({ license: 'MIT' }) };
			}
			throw new Error('registry down');
		});
		vi.stubGlobal('fetch', fetchMock);

		const fetchLicense = npmRegistryLicenseFetcher();

		await expect(fetchLicense('@scope/pkg')).resolves.toBeNull();
		await expect(fetchLicense('missing')).resolves.toBeNull();
		await expect(fetchLicense('network-down')).resolves.toBeNull();
		expect(fetchMock).toHaveBeenCalledWith(
			'https://registry.npmjs.org/%40scope%2Fpkg/latest',
			expect.objectContaining({ signal: expect.any(AbortSignal) })
		);
	});
});
