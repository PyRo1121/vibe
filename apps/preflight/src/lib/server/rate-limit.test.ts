import { describe, expect, it, vi } from 'vitest';
import { assertScanRateLimit, clientIp } from './rate-limit';

describe('clientIp', () => {
	it('prefers CF-Connecting-IP', () => {
		const req = new Request('https://app.test', {
			headers: { 'cf-connecting-ip': '203.0.113.1', 'x-forwarded-for': '10.0.0.1' }
		});
		expect(clientIp(req)).toBe('203.0.113.1');
	});
});

describe('assertScanRateLimit', () => {
	it('skips without KV', async () => {
		await expect(assertScanRateLimit(undefined, '203.0.113.1')).resolves.toBeUndefined();
	});

	it('allows scans under the limit', async () => {
		const kv = {
			get: vi.fn(async () => '2'),
			put: vi.fn(async () => undefined)
		} as unknown as KVNamespace;

		await assertScanRateLimit(kv, '203.0.113.1');
		expect(kv.put).toHaveBeenCalled();
	});
});
