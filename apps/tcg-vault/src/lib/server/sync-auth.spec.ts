import { describe, expect, it } from 'vitest';
import { requireSyncAuth } from './sync-auth';

function authRequest(token?: string) {
	return new Request('http://localhost/api/sync/scryfall', {
		headers: token ? { authorization: `Bearer ${token}` } : undefined
	});
}

describe('requireSyncAuth', () => {
	it('allows requests in development when secret is unset', () => {
		expect(() => requireSyncAuth(authRequest(), undefined, false)).not.toThrow();
	});

	it('rejects production requests when secret is unset', () => {
		expect(() => requireSyncAuth(authRequest(), undefined, true)).toThrow();
	});

	it('rejects wrong bearer token', () => {
		expect(() => requireSyncAuth(authRequest('wrong'), 'secret', true)).toThrow();
	});

	it('accepts correct bearer token', () => {
		expect(() => requireSyncAuth(authRequest('secret'), 'secret', true)).not.toThrow();
	});
});
