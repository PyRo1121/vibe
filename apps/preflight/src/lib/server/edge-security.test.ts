import { describe, expect, it } from 'vitest';

import {
	applySecurityHeaders,
	isBlockedMethod,
	isBlockedProbePath,
	postBodyTooLarge,
	probeBlockResponse
} from './edge-security';

describe('isBlockedProbePath', () => {
	it('blocks common exploit paths', () => {
		expect(isBlockedProbePath('/wp-login.php')).toBe(true);
		expect(isBlockedProbePath('/.env')).toBe(true);
		expect(isBlockedProbePath('/app/.git/config')).toBe(true);
		expect(isBlockedProbePath('/assets/..%2F.env')).toBe(true);
		expect(isBlockedProbePath('/%2e%2e/.env')).toBe(true);
	});

	it('allows normal app routes', () => {
		expect(isBlockedProbePath('/')).toBe(false);
		expect(isBlockedProbePath('/api/scan')).toBe(false);
		expect(isBlockedProbePath('/changelog')).toBe(false);
	});
});

describe('isBlockedMethod', () => {
	it('blocks TRACE and CONNECT', () => {
		expect(isBlockedMethod('TRACE')).toBe(true);
		expect(isBlockedMethod('connect')).toBe(true);
	});

	it('allows normal methods', () => {
		expect(isBlockedMethod('GET')).toBe(false);
		expect(isBlockedMethod('POST')).toBe(false);
	});
});

describe('postBodyTooLarge', () => {
	it('flags oversized POST bodies', () => {
		const req = new Request('https://app.test/api/scan', {
			method: 'POST',
			headers: { 'content-length': '300000' }
		});
		expect(postBodyTooLarge(req)).toBe(true);
	});

	it('ignores oversized bodies for read-only methods and missing lengths', () => {
		expect(
			postBodyTooLarge(
				new Request('https://app.test/api/scan', {
					method: 'GET',
					headers: { 'content-length': '300000' }
				})
			)
		).toBe(false);
		expect(postBodyTooLarge(new Request('https://app.test/api/scan', { method: 'POST' }))).toBe(
			false
		);
	});
});

describe('probeBlockResponse', () => {
	it('returns 404 for probe paths', () => {
		const res = probeBlockResponse(new Request('https://app.test/.env'));
		expect(res?.status).toBe(404);
	});

	it('returns method and body rejections before route handlers run', () => {
		const methodRes = probeBlockResponse({
			method: 'TRACE',
			url: 'https://app.test/api/scan'
		} as Request);
		const bodyRes = probeBlockResponse(
			new Request('https://app.test/api/scan', {
				method: 'POST',
				headers: { 'content-length': '300000' }
			})
		);

		expect(methodRes?.status).toBe(405);
		expect(bodyRes?.status).toBe(413);
	});

	it('allows normal requests through to route handlers', () => {
		expect(probeBlockResponse(new Request('https://app.test/api/scan'))).toBeNull();
	});
});

describe('applySecurityHeaders', () => {
	it('adds standard hardening headers', () => {
		const res = applySecurityHeaders(new Response('ok', { status: 200 }));
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('keeps Cloudflare preview hosts out of search indexes', () => {
		const res = applySecurityHeaders(
			new Response('ok', { status: 200 }),
			'https://deploylint-preview.pages.dev/'
		);

		expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
	});

	it('allows the canonical Deploylint host to be indexed', () => {
		const res = applySecurityHeaders(
			new Response('ok', { status: 200 }),
			'https://deploylint.com/'
		);

		expect(res.headers.get('X-Robots-Tag')).toBeNull();
	});

	it('does not mark malformed request URLs as non-indexable', () => {
		const res = applySecurityHeaders(new Response('ok', { status: 200 }), 'not a url');

		expect(res.headers.get('X-Robots-Tag')).toBeNull();
	});
});
