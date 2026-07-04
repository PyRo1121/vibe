import { describe, it, expect, vi } from 'vitest';
import { probeExposedPaths, probeHealthEndpoints } from './probes';

describe('probeExposedPaths', () => {
	it('flags .env when 200 with KEY= pattern', async () => {
		const headOk = vi.fn(async (url: string) => url.endsWith('/.env'));
		const fetchText = vi.fn(async (url: string) => {
			if (url.endsWith('/.env')) return 'DATABASE_URL=postgres://x\n';
			return null;
		});
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.env.exposed).toBe(true);
		expect(r.git.exposed).toBe(false);
	});

	it('passes when .env returns 404', async () => {
		const headOk = vi.fn(async () => false);
		const fetchText = vi.fn(async () => null);
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.env.exposed).toBe(false);
	});

	it('flags .git/HEAD when ref: visible', async () => {
		const headOk = vi.fn(async (url: string) => url.includes('/.git/HEAD'));
		const fetchText = vi.fn(async () => 'ref: refs/heads/main\n');
		const r = await probeExposedPaths(new URL('https://app.example.com/'), headOk, fetchText);
		expect(r.git.exposed).toBe(true);
	});
});

describe('probeHealthEndpoints', () => {
	it('finds first 2xx among common health paths', async () => {
		const headOk = vi.fn(async (url: string) => url.endsWith('/health'));
		const r = await probeHealthEndpoints(new URL('https://api.example.com/'), headOk);
		expect(r.found).toBe(true);
		expect(r.path).toBe('/health');
	});

	it('returns not found when no path responds', async () => {
		const headOk = vi.fn(async () => false);
		const r = await probeHealthEndpoints(new URL('https://api.example.com/'), headOk);
		expect(r.found).toBe(false);
	});
});
