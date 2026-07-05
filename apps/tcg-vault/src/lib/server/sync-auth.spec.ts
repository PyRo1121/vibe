import { describe, expect, it } from 'vitest';

import { requireSyncAuth } from './sync-auth';

function authRequest(token?: string) {
	return new Request('http://localhost/api/sync/scryfall', {
		headers: token ? { authorization: `Bearer ${token}` } : undefined
	});
}

function captureAuthError(run: () => void): unknown {
	try {
		run();
	} catch (err) {
		return err;
	}
	return undefined;
}

describe('requireSyncAuth', () => {
	it('allows requests in development when secret is unset', () => {
		expect(() => requireSyncAuth(authRequest(), undefined, false)).not.toThrow();
	});

	it('rejects production requests when secret is unset', () => {
		expect(captureAuthError(() => requireSyncAuth(authRequest(), undefined, true))).toMatchObject({
			body: { message: 'SYNC_SECRET is not configured' },
			status: 503
		});
	});

	it('rejects wrong bearer token', () => {
		expect(
			captureAuthError(() => requireSyncAuth(authRequest('wrong'), 'secret', true))
		).toMatchObject({
			body: { message: 'Unauthorized' },
			status: 401
		});
	});

	it('accepts correct bearer token', () => {
		expect(() => requireSyncAuth(authRequest('secret'), 'secret', true)).not.toThrow();
	});
});
