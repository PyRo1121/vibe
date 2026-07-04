import { describe, expect, it, vi } from 'vitest';
import { appHostname, createScanDeps, defaultDeps, wrapSameZoneFetch } from './fetchers';

describe('appHostname', () => {
	it('parses configured app URL', () => {
		expect(appHostname('https://preflight.latham.cloud/')).toBe('preflight.latham.cloud');
	});

	it('returns null for invalid URL', () => {
		expect(appHostname('not-a-url')).toBeNull();
	});
});

describe('wrapSameZoneFetch', () => {
	it('routes same-host requests through the service binding', async () => {
		const self = { fetch: vi.fn(async () => new Response('ok', { status: 200 })) };
		const external = vi.fn(async () => new Response('external', { status: 200 }));
		const siteFetch = wrapSameZoneFetch(self as unknown as Fetcher, 'app.test', external);

		await siteFetch('https://app.test/privacy');
		expect(self.fetch).toHaveBeenCalledWith('https://preflight.internal/privacy', undefined);

		await siteFetch('https://other.test/page');
		expect(external).toHaveBeenCalled();
	});
});

describe('createScanDeps', () => {
	it('returns default deps without SELF binding', () => {
		expect(createScanDeps({ PUBLIC_APP_URL: 'https://app.test' } as Env)).toBe(defaultDeps);
	});
});
