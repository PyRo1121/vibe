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

	it('marks HTTPS as failed when the final URL is plain HTTP', () => {
		const checks = buildBlockedHomepageChecks(500, new URL('http://blocked.test/'));

		expect(checks[1]).toMatchObject({
			id: 'https',
			status: 'fail',
			message: 'Site not on HTTPS'
		});
	});
});

describe('blockedScanMessage', () => {
	it('mentions bot block for 403', () => {
		expect(blockedScanMessage(403)).toContain('403');
		expect(blockedScanMessage(403)).toContain('blocked');
	});

	it('distinguishes auth-gated and server-error homepages', () => {
		expect(blockedScanMessage(401)).toContain('requires auth');
		expect(blockedScanMessage(503)).toContain('server errored');
	});

	it('uses a generic message for other unreadable status codes', () => {
		const msg = blockedScanMessage(451);

		expect(msg).toContain('HTTP 451');
		expect(msg).toContain('could not read the deploy target');
	});

	it('handles missing status without inventing one', () => {
		const msg = blockedScanMessage();
		expect(msg).toContain('Evidence limited');
		expect(msg).not.toMatch(/\d{3}/);
	});
});
