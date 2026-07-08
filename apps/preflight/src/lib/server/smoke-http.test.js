import { describe, expect, it } from 'vitest';

import {
	isScanLimitedResponse,
	isScanRateLimitedResponse,
	scanLimitReason
} from '../../../scripts/smoke-http.mjs';

describe('isScanRateLimitedResponse', () => {
	it('detects production scan rate-limit responses', () => {
		expect(isScanRateLimitedResponse(429, '{"message":"Too many scans - wait"}')).toBe(true);
		expect(
			isScanRateLimitedResponse(
				new Response('Too many scans - wait a few minutes and try again.', { status: 429 }),
				'Too many scans - wait a few minutes and try again.'
			)
		).toBe(true);
	});

	it('does not classify unrelated 429s or failures as scan limits', () => {
		expect(isScanRateLimitedResponse(429, 'Too many checkout attempts')).toBe(false);
		expect(isScanRateLimitedResponse(500, 'Too many scans')).toBe(false);
		expect(isScanRateLimitedResponse(200, 'Too many scans')).toBe(false);
	});
});

describe('scanLimitReason', () => {
	it('classifies daily capacity exhaustion without hiding unrelated 503s', () => {
		const text =
			'{"message":"Daily scan capacity reached - try again after midnight UTC. Deploylint stays on Cloudflare Free tier."}';

		expect(scanLimitReason(503, text)).toContain('daily scan capacity reached');
		expect(isScanLimitedResponse(503, text)).toBe(true);
		expect(scanLimitReason(503, 'upstream unavailable')).toBeNull();
		expect(isScanLimitedResponse(503, 'upstream unavailable')).toBe(false);
	});
});
