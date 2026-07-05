import { describe, expect, it, vi } from 'vitest';

import { assertScanRateLimit, clientIp } from './rate-limit';

function fakeLimiter() {
	const counts = new Map<string, number>();
	return {
		idFromName: (name: string) => name,
		get: (id: string) => ({
			fetch: async (request: Request) => {
				const body = (await request.json()) as { key: string; limit: number };
				const key = `${id}:${body.key}`;
				const next = (counts.get(key) ?? 0) + 1;
				counts.set(key, next);
				return Response.json({ allowed: next <= body.limit });
			}
		})
	} as unknown as DurableObjectNamespace;
}

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

	it('uses the limiter binding atomically for concurrent scan limits', async () => {
		const limiter = fakeLimiter();
		const attempts = await Promise.allSettled(
			Array.from({ length: 16 }, () => assertScanRateLimit(undefined, '203.0.113.1', limiter))
		);

		expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(15);
		expect(
			attempts.filter((r) => r.status === 'rejected' && 'reason' in r && r.reason.status === 429)
		).toHaveLength(1);
	});

	it('allows scans under the limit', async () => {
		const kv = {
			get: vi.fn<(key: string) => Promise<string | null>>(async () => '2'),
			put: vi.fn<(key: string, value: string) => Promise<void>>(async () => {})
		} as unknown as KVNamespace;

		await assertScanRateLimit(kv, '203.0.113.1');
		expect(kv.put).toHaveBeenCalled();
	});

	it('fails closed on KV errors when configured', async () => {
		const kv = {
			get: vi.fn<() => Promise<string | null>>(async () => {
				throw new Error('kv down');
			}),
			put: vi.fn<(key: string, value: string) => Promise<void>>()
		} as unknown as KVNamespace;

		const { assertIpRateLimit } = await import('./rate-limit');
		await expect(
			assertIpRateLimit(
				{
					kv,
					ip: '203.0.113.1',
					prefix: 'api:checkout',
					limit: 12,
					windowMs: 3600_000,
					message: 'limited'
				},
				{
					failClosed: true
				}
			)
		).rejects.toMatchObject({ status: 503 });
	});
});
