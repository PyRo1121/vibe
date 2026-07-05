import { describe, expect, it } from 'vitest';

import {
	blockedScanMessage,
	buildBlockedHomepageChecks,
	isBlockedHomepageStatus
} from './coverage';

describe('isBlockedHomepageStatus', () => {
	it('treats 4xx and 5xx as blocked', () => {
		expect(isBlockedHomepageStatus(403)).toBe(true);
		expect(isBlockedHomepageStatus(500)).toBe(true);
		expect(isBlockedHomepageStatus(399)).toBe(false);
		expect(isBlockedHomepageStatus(200)).toBe(false);
	});
});

describe('buildBlockedHomepageChecks', () => {
	it('returns only reachability checks', () => {
		const checks = buildBlockedHomepageChecks(403, new URL('https://blocked.test/'));
		expect(checks.map((c) => c.id)).toEqual(['reachable', 'https']);
		expect(checks[0].status).toBe('fail');
		expect(checks[0].message).toContain('403');
	});
});

describe('blockedScanMessage', () => {
	it('mentions bot block for 403', () => {
		expect(blockedScanMessage(403)).toContain('403');
		expect(blockedScanMessage(403)).toContain('blocked');
	});

	it('handles missing status without inventing one', () => {
		const msg = blockedScanMessage();
		expect(msg).toContain('Scan incomplete');
		expect(msg).not.toMatch(/\d{3}/);
	});
});
