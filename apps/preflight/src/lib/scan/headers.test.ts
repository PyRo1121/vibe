import { describe, expect, it } from 'vitest';

import {
	clickjackStatus,
	cspStatus,
	hstsStatus,
	mimeSniffStatus,
	permissionsPolicyStatus,
	pickSecurityHeaders,
	referrerPolicyStatus
} from './headers';

describe('pickSecurityHeaders', () => {
	it('reads security headers from a Response', () => {
		const res = new Response('', {
			headers: {
				'strict-transport-security': 'max-age=63072000',
				'content-security-policy': "default-src 'self'",
				'x-frame-options': 'DENY',
				'x-content-type-options': 'nosniff',
				'referrer-policy': 'no-referrer',
				'permissions-policy': 'camera=(), microphone=()'
			}
		});
		const headers = pickSecurityHeaders(res);
		expect(headers.hsts).toContain('max-age');
		expect(headers.csp).toContain('default-src');
		expect(headers.xFrameOptions).toBe('DENY');
		expect(headers.permissionsPolicy).toContain('camera=()');
	});
});

describe('header status helpers', () => {
	it('passes strong HSTS on HTTPS', () => {
		expect(hstsStatus({ ...empty(), hsts: 'max-age=31536000' }, true)).toBe('pass');
	});

	it('warns when HSTS is missing or too weak on HTTPS', () => {
		expect(hstsStatus(empty(), true)).toBe('warn');
		expect(hstsStatus({ ...empty(), hsts: 'max-age=0' }, true)).toBe('warn');
		expect(hstsStatus({ ...empty(), hsts: 'max-age=300' }, true)).toBe('warn');
	});

	it('detects clickjacking protection via CSP', () => {
		expect(clickjackStatus({ ...empty(), csp: "frame-ancestors 'none'" })).toBe('pass');
		expect(clickjackStatus({ ...empty(), csp: 'frame-ancestors *' })).toBe('warn');
		expect(clickjackStatus({ ...empty(), xFrameOptions: 'ALLOWALL' })).toBe('warn');
		expect(clickjackStatus({ ...empty(), xFrameOptions: 'SAMEORIGIN' })).toBe('pass');
	});

	it('detects nosniff', () => {
		expect(mimeSniffStatus({ ...empty(), xContentTypeOptions: 'nosniff' })).toBe('pass');
		expect(mimeSniffStatus({ ...empty(), xContentTypeOptions: 'nosniff; mode=block' })).toBe(
			'warn'
		);
	});

	it('detects protective CSP and referrer policy', () => {
		expect(cspStatus({ ...empty(), csp: "default-src 'self'" })).toBe('pass');
		expect(cspStatus({ ...empty(), csp: 'upgrade-insecure-requests' })).toBe('warn');
		expect(cspStatus({ ...empty(), csp: "default-src * 'unsafe-inline'" })).toBe('warn');
		expect(referrerPolicyStatus({ ...empty(), referrerPolicy: 'strict-origin' })).toBe('pass');
		expect(referrerPolicyStatus({ ...empty(), referrerPolicy: 'unsafe-url' })).toBe('warn');
		expect(referrerPolicyStatus({ ...empty(), referrerPolicy: 'no-referrer-when-downgrade' })).toBe(
			'warn'
		);
	});

	it('detects Permissions-Policy', () => {
		expect(
			permissionsPolicyStatus({
				...empty(),
				permissionsPolicy: 'camera=(), microphone=(), geolocation=()'
			})
		).toBe('pass');
		expect(permissionsPolicyStatus({ ...empty(), permissionsPolicy: 'camera=()' })).toBe('warn');
		expect(permissionsPolicyStatus({ ...empty(), permissionsPolicy: 'fullscreen=*' })).toBe('warn');
		expect(permissionsPolicyStatus(empty())).toBe('warn');
	});
});

function empty() {
	return {
		hsts: null,
		csp: null,
		xFrameOptions: null,
		xContentTypeOptions: null,
		referrerPolicy: null,
		permissionsPolicy: null
	};
}
