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
});

describe('probeBlockResponse', () => {
	it('returns 404 for probe paths', () => {
		const res = probeBlockResponse(new Request('https://app.test/.env'));
		expect(res?.status).toBe(404);
	});
});

describe('applySecurityHeaders', () => {
	it('adds standard hardening headers', () => {
		const res = applySecurityHeaders(new Response('ok', { status: 200 }));
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
	});
});
