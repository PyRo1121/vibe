import { describe, expect, it } from 'vitest';

import { load } from './+layout.server';

function loadLayout(env: Partial<Env>) {
	return load({ platform: { env } } as Parameters<typeof load>[0]);
}

describe('layout analytics config', () => {
	it('emits a domain-scoped Plausible proxy URL to bust stale script caches', () => {
		expect(loadLayout({ PUBLIC_PLAUSIBLE_DOMAIN: ' deploylint.com ' })).toEqual({
			plausibleDomain: 'deploylint.com',
			plausibleProxy: {
				script: '/s/script.js?site=deploylint.com',
				endpoint: '/s/event'
			}
		});
	});

	it('omits Plausible when no public analytics domain is configured', () => {
		expect(loadLayout({ PUBLIC_PLAUSIBLE_DOMAIN: ' ' })).toEqual({
			plausibleDomain: null,
			plausibleProxy: null
		});
	});
});
