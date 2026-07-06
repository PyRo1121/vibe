import type { ScanContext } from '$lib/scan/checks/context';
import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushOperationalChecks } from './operational';

const BASE_SCAN_CTX: ScanContext = {
	redirectHops: 0,
	ogImage: { reachable: null, isImage: null, contentType: null },
	robotsText: null
};
const CTX = { url: 'https://app.test/' };

function run(scanCtx: Partial<ScanContext>): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushOperationalChecks(checks, { ...BASE_SCAN_CTX, ...scanCtx }, CTX);
	return checks;
}

describe('pushOperationalChecks', () => {
	it('scores response time across fast, slow, and very slow homepages', () => {
		const fast = run({ responseTimeMs: 1199 }).find((check) => check.id === 'response-time');
		const slow = run({ responseTimeMs: 1200 }).find((check) => check.id === 'response-time');
		const verySlow = run({ responseTimeMs: 3000 }).find((check) => check.id === 'response-time');

		expect(fast).toMatchObject({
			status: 'pass',
			message: 'Homepage responded in 1199ms'
		});
		expect(slow).toMatchObject({ status: 'warn' });
		expect(slow?.message).toContain('Slow first response');
		expect(verySlow).toMatchObject({ status: 'warn' });
		expect(verySlow?.message).toContain('Very slow first response (3.0s)');
	});

	it('reports real 404/410 handling and soft 404s without emitting on unrelated statuses', () => {
		const notFound = run({ notFoundStatus: 404 }).find((check) => check.id === 'not-found-page');
		const gone = run({ notFoundStatus: 410 }).find((check) => check.id === 'not-found-page');
		const soft404 = run({ notFoundStatus: 200 }).find((check) => check.id === 'not-found-page');
		const serverError = run({ notFoundStatus: 500 }).find((check) => check.id === 'not-found-page');

		expect(notFound).toMatchObject({ status: 'pass' });
		expect(gone).toMatchObject({ status: 'pass' });
		expect(soft404).toMatchObject({ status: 'warn' });
		expect(soft404?.message).toContain('soft 404');
		expect(serverError).toBeUndefined();
	});

	it('scores SPF and DMARC combinations explicitly', () => {
		const pass = run({
			emailAuth: { spf: true, dmarc: true, domain: 'example.com' }
		}).find((check) => check.id === 'email-auth');
		const spfOnly = run({
			emailAuth: { spf: true, dmarc: false, domain: 'example.com' }
		}).find((check) => check.id === 'email-auth');
		const missingBoth = run({
			emailAuth: { spf: false, dmarc: false, domain: 'example.com' }
		}).find((check) => check.id === 'email-auth');

		expect(pass).toMatchObject({ status: 'pass' });
		expect(spfOnly).toMatchObject({ status: 'warn' });
		expect(spfOnly?.message).toContain('SPF found but no DMARC');
		expect(missingBoth).toMatchObject({ status: 'warn' });
		expect(missingBoth?.message).toContain('No SPF or DMARC');
	});

	it('describes DMARC-only email authentication accurately', () => {
		const checks = run({
			emailAuth: { spf: false, dmarc: true, domain: 'example.com' }
		});

		const email = checks.find((check) => check.id === 'email-auth');

		expect(email?.status).toBe('warn');
		expect(email?.message).toContain('DMARC found but no SPF');
		expect(email?.message).not.toContain('No SPF or DMARC');
	});

	it('emits DKIM only after SPF exists and scores found versus missing selectors', () => {
		const skipped = run({
			emailAuth: { spf: false, dmarc: true, domain: 'example.com' },
			dkimDns: { dkim: true, domain: 'example.com', selector: 'default' }
		}).find((check) => check.id === 'dkim-dns');
		const missing = run({
			emailAuth: { spf: true, dmarc: true, domain: 'example.com' },
			dkimDns: { dkim: false, domain: 'example.com', selector: 'default' }
		}).find((check) => check.id === 'dkim-dns');
		const found = run({
			emailAuth: { spf: true, dmarc: true, domain: 'example.com' },
			dkimDns: { dkim: true, domain: 'example.com', selector: 'mail' }
		}).find((check) => check.id === 'dkim-dns');

		expect(skipped).toBeUndefined();
		expect(missing).toMatchObject({ status: 'warn' });
		expect(missing?.message).toContain('no DKIM selector');
		expect(found).toMatchObject({ status: 'pass' });
		expect(found?.message).toContain('mail._domainkey.example.com');
	});

	it('scores apex/www consistency for same-site, unresolved, and different-site outcomes', () => {
		const same = run({
			hostConsistency: { altHost: 'www.app.test', resolves: true, sameSite: true }
		}).find((check) => check.id === 'host-consistency');
		const unresolved = run({
			hostConsistency: { altHost: 'www.app.test', resolves: false, sameSite: false }
		}).find((check) => check.id === 'host-consistency');
		const different = run({
			hostConsistency: { altHost: 'www.app.test', resolves: true, sameSite: false }
		}).find((check) => check.id === 'host-consistency');

		expect(same).toMatchObject({ status: 'pass' });
		expect(unresolved).toMatchObject({ status: 'warn' });
		expect(unresolved?.message).toContain('does not resolve');
		expect(different).toMatchObject({ status: 'warn' });
		expect(different?.message).toContain('serves a different site');
	});
});
