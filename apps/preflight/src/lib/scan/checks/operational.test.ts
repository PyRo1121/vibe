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
	it('describes DMARC-only email authentication accurately', () => {
		const checks = run({
			emailAuth: { spf: false, dmarc: true, domain: 'example.com' }
		});

		const email = checks.find((check) => check.id === 'email-auth');

		expect(email?.status).toBe('warn');
		expect(email?.message).toContain('DMARC found but no SPF');
		expect(email?.message).not.toContain('No SPF or DMARC');
	});
});
