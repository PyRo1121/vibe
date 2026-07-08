import type { Handle } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthSession = { session: App.Locals['session']; user: App.Locals['user'] };
type MockDeploylintAuth = {
	api: {
		getSession(input: { headers: Headers }): Promise<AuthSession | null>;
	};
};
type MockSvelteKitHandlerInput = Parameters<Handle>[0] & {
	auth: MockDeploylintAuth;
	building: boolean;
};

const { mockGetDeploylintAuth, mockSvelteKitHandler } = vi.hoisted(() => ({
	mockGetDeploylintAuth:
		vi.fn<(env: Partial<Env> | undefined, requestOrigin: string) => MockDeploylintAuth | null>(),
	mockSvelteKitHandler: vi.fn<(input: MockSvelteKitHandlerInput) => Promise<Response>>()
}));

vi.mock('$lib/server/auth', () => ({
	getDeploylintAuth: mockGetDeploylintAuth
}));

vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: mockSvelteKitHandler
}));

import { handle } from './hooks.server';

const resolve: Parameters<Handle>[0]['resolve'] = async () => new Response('ok');

beforeEach(() => {
	mockGetDeploylintAuth.mockReturnValue(null);
	mockSvelteKitHandler.mockImplementation(async ({ event, resolve: resolveRequest }) =>
		resolveRequest(event)
	);
});

function fakeKv(value: string | null) {
	return {
		get: async () => value,
		put: async () => {}
	} as unknown as KVNamespace;
}

function requestHost(host: string, appUrl = 'https://deploylint.com', protocol = 'https') {
	return handle({
		event: {
			request: new Request(`${protocol}://${host}/developers?x=1`, { headers: { host } }),
			url: new URL(`${protocol}://${host}/developers?x=1`),
			locals: {},
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
			locals: {},
			platform: { env: { PUBLIC_APP_URL: appUrl } }
		} as Parameters<Handle>[0]['event'],
		resolve
	});
}

function requestWithEnv(
	host: string,
	path: string,
	env: Partial<Env>,
	headers: Record<string, string> = {}
) {
	return handle({
		event: {
			request: new Request(`https://${host}${path}`, { headers: { host, ...headers } }),
			url: new URL(`https://${host}${path}`),
			locals: {},
			platform: { env }
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

	it('keeps legacy /s routes serving in place for analytics clients', async () => {
		const response = await requestPath('lint.latham.cloud', '/s/event');
		expect(response.status).toBe(200);
	});

	it('returns 503 for auth endpoints when auth storage is not configured', async () => {
		const response = await requestPath('deploylint.com', '/api/auth/session');

		expect(response.status).toBe(503);
		expect(await response.text()).toBe('Authentication is not configured');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('converts API edge rate limits into text responses with security headers', async () => {
		const response = await requestWithEnv(
			'deploylint.com',
			'/api/events',
			{
				PUBLIC_APP_URL: 'https://deploylint.com',
				REPORTS: fakeKv('90')
			},
			{ 'cf-connecting-ip': '203.0.113.10' }
		);

		expect(response.status).toBe(429);
		expect(await response.text()).toBe('Too many events — slow down.');
		expect(response.headers.get('Content-Type')).toContain('text/plain');
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('marks Cloudflare preview hosts as non-indexable', async () => {
		const response = await requestHost('deploylint-preview.pages.dev');

		expect(response.status).toBe(200);
		expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
	});

	it('hydrates locals from an authenticated session before resolving the request', async () => {
		const session = { id: 'session_123', userId: 'user_123' } as App.Locals['session'];
		const user = { id: 'user_123', email: 'dev@example.com', name: 'Dev' } as App.Locals['user'];
		const getSession = vi.fn<(input: { headers: Headers }) => Promise<AuthSession>>(async () => ({
			session,
			user
		}));
		const auth = { api: { getSession } };
		const locals = { session: null, user: null };
		mockGetDeploylintAuth.mockReturnValueOnce(auth);

		const event = {
			request: new Request('https://deploylint.com/app', {
				headers: { host: 'deploylint.com', cookie: 'better-auth.session_token=test' }
			}),
			url: new URL('https://deploylint.com/app'),
			locals,
			platform: { env: { AUTH_DB: {} } }
		} as Parameters<Handle>[0]['event'];

		const response = await handle({ event, resolve });

		expect(response.status).toBe(200);
		expect(getSession).toHaveBeenCalledWith({ headers: event.request.headers });
		expect(locals.session).toBe(session);
		expect(locals.user).toBe(user);
		expect(mockSvelteKitHandler).toHaveBeenCalledWith(
			expect.objectContaining({ event, resolve, auth })
		);
	});
});
