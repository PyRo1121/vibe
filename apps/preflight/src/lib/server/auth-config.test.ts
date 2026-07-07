import { describe, expect, it } from 'vitest';

import {
	AUTH_ROUTE_PREFIX,
	buildLoginRedirect,
	resolveAuthFeatureFlags,
	resolveAuthSecret
} from './auth-config';

describe('auth config', () => {
	it('keeps Better Auth mounted under the API auth prefix', () => {
		expect(AUTH_ROUTE_PREFIX).toBe('/api/auth');
	});

	it('builds a local-only login redirect target', () => {
		expect(buildLoginRedirect(new URL('https://deploylint.com/app?tab=billing'))).toBe(
			'/login?redirectTo=%2Fapp%3Ftab%3Dbilling'
		);
		expect(buildLoginRedirect(new URL('https://deploylint.com/login'))).toBe('/login');
	});

	it('reports which auth methods can be used with the configured secrets', () => {
		expect(
			resolveAuthFeatureFlags({
				GITHUB_CLIENT_ID: 'gh-client',
				GITHUB_CLIENT_SECRET: 'gh-secret',
				RESEND_API_KEY: 're_test',
				RESEND_FROM_EMAIL: 'Deploylint <login@deploylint.com>'
			})
		).toEqual({
			emailPassword: true,
			emailDelivery: true,
			github: true
		});
	});

	it('uses an explicit secret in production and a deterministic local fallback for dev', () => {
		expect(resolveAuthSecret({ BETTER_AUTH_SECRET: 'prod-secret' }, 'https://deploylint.com')).toBe(
			'prod-secret'
		);
		expect(resolveAuthSecret({}, 'http://localhost:5173')).toMatch(/^dev-only-/);
		expect(resolveAuthSecret({}, 'https://deploylint.com')).toBeNull();
	});
});
