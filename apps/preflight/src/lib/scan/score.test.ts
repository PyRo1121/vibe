import { describe, expect, it } from 'vitest';

import { buildReport, makeCheck, scoreChecks } from './score';

describe('scoreChecks', () => {
	it('caps score when site is unreachable', () => {
		const checks = [
			makeCheck('reachable', 'launch', 'Site reachable', 'fail', 'HTTP 500', 'fix'),
			makeCheck('https', 'security', 'HTTPS', 'pass', 'ok', 'fix')
		];
		expect(scoreChecks(checks)).toBeLessThanOrEqual(25);
	});
});

describe('buildReport payment readiness', () => {
	it('summarizes revenue blockers from payment checks', () => {
		const report = buildReport('https://app.test', new URL('https://app.test/'), [
			makeCheck(
				'checkout-server-owned',
				'payments',
				'Server-owned checkout',
				'fail',
				'Checkout is browser-owned.',
				'fix checkout'
			),
			makeCheck(
				'billing-portal',
				'payments',
				'Customer billing portal',
				'warn',
				'No billing portal route.',
				'fix portal'
			),
			makeCheck('https', 'security', 'HTTPS', 'pass', 'Served over HTTPS.', 'fix')
		]);

		expect(report.paymentReadiness).toMatchObject({
			status: 'blocked',
			fail: 1,
			warn: 1,
			pass: 0,
			checked: ['checkout-server-owned', 'billing-portal']
		});
		expect(report.paymentReadiness?.blockers[0]).toContain('Server-owned checkout');
		expect(report.paymentReadiness?.warnings[0]).toContain('Customer billing portal');
	});

	it('marks payment readiness as not detected when no payment checks ran', () => {
		const report = buildReport('https://app.test', new URL('https://app.test/'), [
			makeCheck('https', 'security', 'HTTPS', 'pass', 'Served over HTTPS.', 'fix')
		]);

		expect(report.paymentReadiness).toMatchObject({
			status: 'not-detected',
			pass: 0,
			warn: 0,
			fail: 0,
			checked: []
		});
	});
});
