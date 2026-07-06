import { describe, it, expect, vi } from 'vitest';

import { probeExposedPaths, probeHealthEndpoints } from './probes';

type HeadOk = (url: string) => Promise<boolean>;
type FetchText = (url: string) => Promise<string | null>;

describe('probeExposedPaths', () => {
	it('flags .env when 200 with KEY= pattern', async () => {
		const headOk = vi.fn<HeadOk>(async (url) => url.endsWith('/.env'));
		const fetchText = vi.fn<FetchText>(async (url) => {
			if (url.endsWith('/.env')) return 'DATABASE_URL=postgres://x\n';
			return null;
		});
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.env.exposed).toBe(true);
		expect(r.git.exposed).toBe(false);
	});

	it('passes when .env returns 404', async () => {
		const headOk = vi.fn<HeadOk>(async () => false);
		const fetchText = vi.fn<FetchText>(async () => null);
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.env.exposed).toBe(false);
	});

	it('flags .git/HEAD when ref: visible', async () => {
		const headOk = vi.fn<HeadOk>(async (url) => url.includes('/.git/HEAD'));
		const fetchText = vi.fn<FetchText>(async () => 'ref: refs/heads/main\n');
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.git.exposed).toBe(true);
	});

	it('flags exposed backup archives, env backups, SQL dumps, and package manifests', async () => {
		const headOk = vi.fn<HeadOk>(async (url) =>
			['/backup.zip', '/.env.bak', '/package.json', '/db.sql'].some((path) => url.endsWith(path))
		);
		const fetchText = vi.fn<FetchText>(async (url) => {
			if (url.endsWith('/backup.zip')) return 'PK'.padEnd(128, 'x');
			if (url.endsWith('/.env.bak')) return 'PASSWORD=secret\n';
			if (url.endsWith('/package.json')) return '{"name":"public-app"}';
			if (url.endsWith('/db.sql')) return 'CREATE TABLE users (id integer);';
			return null;
		});

		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);

		expect(r.backup.exposed).toBe(true);
		expect(r.backup.url).toBe('https://app.example.com/backup.zip');
		expect(r.packageJson.exposed).toBe(true);
		expect(r.packageJson.url).toBe('https://app.example.com/package.json');
	});

	it('does not flag reachable sensitive-looking paths when bodies do not match proof patterns', async () => {
		const headOk = vi.fn<HeadOk>(async () => true);
		const fetchText = vi.fn<FetchText>(async (url) => {
			if (url.endsWith('/.env')) return '<html>SPA fallback</html>';
			if (url.endsWith('/.git/HEAD')) return '<html>Not found</html>';
			if (url.endsWith('/backup.zip')) return 'short';
			if (url.endsWith('/.env.bak')) return 'not configuration';
			if (url.endsWith('/package.json')) return '<html>App shell</html>';
			if (url.endsWith('/db.sql')) return 'select pricing from page copy';
			return null;
		});

		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);

		expect(r.env.exposed).toBe(false);
		expect(r.git.exposed).toBe(false);
		expect(r.backup.exposed).toBe(false);
		expect(r.packageJson.exposed).toBe(false);
	});
});

describe('probeHealthEndpoints', () => {
	it('finds first 2xx among common health paths', async () => {
		const headOk = vi.fn<HeadOk>(async (url) => url.endsWith('/health'));
		const r = await probeHealthEndpoints(new URL('https://api.example.com/'), headOk);
		expect(r.found).toBe(true);
		expect(r.path).toBe('/health');
	});

	it('returns not found when no path responds', async () => {
		const headOk = vi.fn<HeadOk>(async () => false);
		const r = await probeHealthEndpoints(new URL('https://api.example.com/'), headOk);
		expect(r.found).toBe(false);
	});

	it('checks API health and status paths promised by the scan copy', async () => {
		const headOk = vi.fn<HeadOk>(async (url) => url.endsWith('/api/health'));
		const r = await probeHealthEndpoints(new URL('https://api.example.com/'), headOk);
		expect(r.found).toBe(true);
		expect(r.path).toBe('/api/health');
	});
});
