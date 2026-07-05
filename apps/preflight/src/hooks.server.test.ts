import type { Handle } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';

import { handle } from './hooks.server';

const resolve: Parameters<Handle>[0]['resolve'] = async () => new Response('ok');

function requestHost(host: string, appUrl = 'https://deploylint.com', protocol = 'https') {
	return handle({
		event: {
			request: new Request(`${protocol}://${host}/developers?x=1`, { headers: { host } }),
			url: new URL(`${protocol}://${host}/developers?x=1`),
			platform: { env: { PUBLIC_APP_URL: appUrl } }
		} as Parameters<Handle>[0]['event'],
		resolve
	});
}

function requestPath(host: string, path: string, appUrl = 'https://deploylint.com') {
	return handle({
		event: {
			request: new Request(`https://${host}${path}`, { headers: { host } }),
			url: new URL(`https://${host}${path}`),
			platform: { env: { PUBLIC_APP_URL: appUrl } }
		} as Parameters<Handle>[0]['event'],
		resolve
	});
}

describe('handle canonical redirects', () => {
	it('redirects legacy and www hosts to the configured deploylint.com canonical host', async () => {
		const legacy = await requestHost('lint.latham.cloud');
		expect(legacy.status).toBe(301);
		expect(legacy.headers.get('location')).toBe('https://deploylint.com/developers?x=1');

		const www = await requestHost('www.deploylint.com');
		expect(www.status).toBe(301);
		expect(www.headers.get('location')).toBe('https://deploylint.com/developers?x=1');
	});

	it('serves the apex deploylint.com host without redirecting to itself', async () => {
		const response = await requestHost('deploylint.com');
		expect(response.status).toBe(200);
	});

	it('redirects plain HTTP apex requests to HTTPS', async () => {
		const response = await requestHost('deploylint.com', 'https://deploylint.com', 'http');
		expect(response.status).toBe(301);
		expect(response.headers.get('location')).toBe('https://deploylint.com/developers?x=1');
	});

	it('keeps legacy API routes serving in place for webhooks and old clients', async () => {
		const response = await requestPath('lint.latham.cloud', '/api/webhooks/stripe');
		expect(response.status).toBe(200);
	});
});
