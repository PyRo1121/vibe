import { describe, expect, it } from 'vitest';

import { load } from './+layout.server';

function loadLayout(env: Partial<Env>) {
	return load({ platform: { env } } as Parameters<typeof load>[0]);
}

describe('layout analytics config', () => {
	it('emits the new Deploylint Plausible personalized script URL', () => {
		expect(
			loadLayout({
				PUBLIC_PLAUSIBLE_DOMAIN: ' deploylint.com ',
				PUBLIC_PLAUSIBLE_SCRIPT: ' https://plausible.io/js/pa-kDKT3UQlQwf5rMj8gkKwW.js '
			})
		).toEqual({
			alphaFreeUnlock: false,
			plausibleDomain: 'deploylint.com',
			plausibleScript: 'https://plausible.io/js/pa-kDKT3UQlQwf5rMj8gkKwW.js'
		});
	});

	it('omits Plausible when no public analytics domain is configured', () => {
		expect(loadLayout({ PUBLIC_PLAUSIBLE_DOMAIN: ' ' })).toEqual({
			alphaFreeUnlock: false,
			plausibleDomain: null,
			plausibleScript: null
		});
	});

	it('enables alpha free unlock only from the explicit env flag', () => {
		expect(loadLayout({ DEPLOYLINT_ALPHA_FREE_UNLOCK: 'true' })).toMatchObject({
			alphaFreeUnlock: true
		});
	});
});
