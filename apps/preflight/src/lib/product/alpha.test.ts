import { describe, expect, it } from 'vitest';

import { resolveAlphaFreeUnlock } from './alpha';

describe('resolveAlphaFreeUnlock', () => {
	it('keeps the product free by default while early telemetry is collected', () => {
		expect(resolveAlphaFreeUnlock()).toBe(true);
		expect(resolveAlphaFreeUnlock({})).toBe(true);
	});

	it('lets operators explicitly restore paid gating later', () => {
		for (const value of ['0', 'false', 'no', 'off']) {
			expect(resolveAlphaFreeUnlock({ DEPLOYLINT_ALPHA_FREE_UNLOCK: value })).toBe(false);
		}
	});

	it('keeps common truthy flags enabled', () => {
		for (const value of ['1', 'true', 'yes', 'on']) {
			expect(resolveAlphaFreeUnlock({ DEPLOYLINT_ALPHA_FREE_UNLOCK: value })).toBe(true);
		}
	});
});
