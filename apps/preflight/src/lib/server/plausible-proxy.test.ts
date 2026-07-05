import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	plausibleUpstreamScript,
	proxyPlausibleEvent,
	proxyPlausibleScript
} from './plausible-proxy';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('plausibleUpstreamScript', () => {
	it('falls back to default script URL', () => {
		expect(plausibleUpstreamScript()).toBe('https://plausible.io/js/script.js');
	});

	it('ignores Plausible personalized script overrides because they bake in a site domain', () => {
		expect(
			plausibleUpstreamScript({
				PUBLIC_PLAUSIBLE_SCRIPT: 'https://plausible.io/js/pa-6HNboY8BBbu4MK_Qmeoxr.js'
			})
		).toBe('https://plausible.io/js/script.js');
	});

	it('allows non-personalized upstream script overrides', () => {
		expect(
			plausibleUpstreamScript({
				PUBLIC_PLAUSIBLE_SCRIPT: 'https://analytics.example.com/js/script.js'
			})
		).toBe('https://analytics.example.com/js/script.js');
	});
});

describe('proxyPlausibleScript', () => {
	it('returns javascript content-type', async () => {
		fetchMock.mockResolvedValueOnce(new Response('console.log("plausible")', { status: 200 }));

		const res = await proxyPlausibleScript('https://plausible.io/js/script.js');

		expect(res.headers.get('Content-Type')).toContain('javascript');
		expect(await res.text()).toContain('plausible');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://plausible.io/js/script.js',
			expect.objectContaining({
				headers: { Accept: 'application/javascript,*/*' }
			})
		);
	});

	it('uses a long cache lifetime for the stable first-party script proxy', async () => {
		fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const res = await proxyPlausibleScript('https://plausible.io/js/script.js');

		expect(res.headers.get('Cache-Control')).toBe(
			'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400'
		);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});
});

describe('proxyPlausibleEvent', () => {
	it('forwards analytics body and privacy-preserving client headers', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(null, {
				status: 202,
				headers: { 'x-plausible-dropped': 'false' }
			})
		);

		const res = await proxyPlausibleEvent(
			new Request('https://deploylint.com/s/event', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Vitest',
					'CF-Connecting-IP': '203.0.113.1'
				},
				body: JSON.stringify({ name: 'pageview' })
			})
		);

		expect(res.status).toBe(202);
		expect(res.headers.get('x-plausible-dropped')).toBe('false');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://plausible.io/api/event',
			expect.objectContaining({
				method: 'POST',
				body: '{"name":"pageview"}'
			})
		);
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const headers = init.headers as Headers;
		expect(headers.get('Content-Type')).toBe('application/json');
		expect(headers.get('User-Agent')).toBe('Vitest');
		expect(headers.get('X-Forwarded-For')).toBe('203.0.113.1');
	});

	it('falls back to X-Forwarded-For when Cloudflare client IP is absent', async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

		await proxyPlausibleEvent(
			new Request('https://deploylint.com/s/event', {
				method: 'POST',
				headers: { 'X-Forwarded-For': '198.51.100.9' },
				body: '{}'
			})
		);

		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		const headers = init.headers as Headers;
		expect(headers.get('X-Forwarded-For')).toBe('198.51.100.9');
	});
});
