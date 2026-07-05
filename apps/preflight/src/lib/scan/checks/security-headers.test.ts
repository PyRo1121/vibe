import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushHeaderChecks } from './security-headers';

function run(headers: Parameters<typeof pushHeaderChecks>[1]): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushHeaderChecks(checks, headers, true, { url: 'https://app.test/' });
	return checks;
}

describe('pushHeaderChecks', () => {
	it('emits warning checks for missing HTTPS security headers', () => {
		const checks = run({
			hsts: null,
			csp: null,
			xFrameOptions: null,
			xContentTypeOptions: null,
			referrerPolicy: null,
			permissionsPolicy: null
		});

		for (const id of [
			'hsts-header',
			'csp-header',
			'clickjack-header',
			'mime-sniff-header',
			'referrer-header',
			'permissions-policy-header'
		]) {
			expect(checks.find((check) => check.id === id)?.status).toBe('warn');
		}
	});

	it('passes when all expected HTTPS security headers are present', () => {
		const checks = run({
			hsts: 'max-age=31536000; includeSubDomains',
			csp: "default-src 'self'; frame-ancestors 'none'",
			xFrameOptions: null,
			xContentTypeOptions: 'nosniff',
			referrerPolicy: 'strict-origin-when-cross-origin',
			permissionsPolicy: 'camera=(), microphone=()'
		});

		for (const check of checks) {
			expect(check.status).toBe('pass');
			expect(check.category).toBe('security');
			expect(check.fixPrompt.length).toBeGreaterThan(0);
		}
	});

	it('does not emit header checks for HTTP URLs because HTTPS must be fixed first', () => {
		const checks: ScanCheck[] = [];
		pushHeaderChecks(
			checks,
			{
				hsts: null,
				csp: null,
				xFrameOptions: null,
				xContentTypeOptions: null,
				referrerPolicy: null,
				permissionsPolicy: null
			},
			false,
			{ url: 'http://app.test/' }
		);

		expect(checks).toEqual([]);
	});
});
