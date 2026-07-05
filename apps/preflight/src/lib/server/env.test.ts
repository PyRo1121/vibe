import { describe, expect, it } from 'vitest';
import { resolveAppUrl } from './env';

describe('resolveAppUrl', () => {
	it('prefers configured PUBLIC_APP_URL over request origin', () => {
		expect(
			resolveAppUrl({ PUBLIC_APP_URL: 'https://deploylint.com/' } as Env, 'http://evil.test')
		).toBe('https://deploylint.com');
	});

	it('allows request-origin fallback for local development', () => {
		expect(resolveAppUrl({ STRIPE_SECRET_KEY: 'sk_test_x' } as Env, 'http://localhost:5173')).toBe(
			'http://localhost:5173'
		);
		expect(resolveAppUrl({ STRIPE_SECRET_KEY: 'sk_test_x' } as Env, 'http://127.0.0.1:5173/')).toBe(
			'http://127.0.0.1:5173'
		);
	});

	it('fails closed without PUBLIC_APP_URL on non-local origins', () => {
		expect(() =>
			resolveAppUrl({ STRIPE_SECRET_KEY: 'sk_live_x' } as Env, 'https://evil.test')
		).toThrow();
	});
});
