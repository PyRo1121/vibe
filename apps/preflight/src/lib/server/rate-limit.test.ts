import { describe, expect, it, vi } from 'vitest';

import { assertIpRateLimit, assertScanRateLimit, clientIp } from './rate-limit';

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

	it('falls back to the first forwarded IP and then unknown', () => {
		expect(
			clientIp(
				new Request('https://app.test', {
					headers: { 'x-forwarded-for': ' 203.0.113.2, 10.0.0.1 ' }
				})
			)
		).toBe('203.0.113.2');
		expect(clientIp(new Request('https://app.test'))).toBe('unknown');
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

	it('blocks scans at the KV fallback limit', async () => {
		const kv = {
			get: vi.fn<(key: string) => Promise<string | null>>(async () => '15'),
			put: vi.fn<(key: string, value: string) => Promise<void>>(async () => {})
		} as unknown as KVNamespace;

		await expect(assertScanRateLimit(kv, '203.0.113.1')).rejects.toMatchObject({ status: 429 });
		expect(kv.put).not.toHaveBeenCalled();
	});

	it('normalizes malformed KV counts before incrementing', async () => {
		const kv = {
			get: vi.fn<(key: string) => Promise<string | null>>(async () => 'not-a-number'),
			put: vi.fn<(key: string, value: string) => Promise<void>>(async () => {})
		} as unknown as KVNamespace;

		await assertScanRateLimit(kv, '203.0.113.1');

		expect(kv.put).toHaveBeenCalledWith(expect.any(String), '1', {
			expirationTtl: expect.any(Number)
		});
	});

	it('skips KV fallback for unknown IPs', async () => {
		const kv = {
			get: vi.fn<(key: string) => Promise<string | null>>(async () => '0'),
			put: vi.fn<(key: string, value: string) => Promise<void>>(async () => {})
		} as unknown as KVNamespace;

		await assertScanRateLimit(kv, 'unknown');

		expect(kv.get).not.toHaveBeenCalled();
		expect(kv.put).not.toHaveBeenCalled();
	});

	it('fails open for scan limits when the Durable Object is unavailable', async () => {
		const limiter = {
			idFromName: (name: string) => name,
			get: () => ({
				fetch: async () => new Response('down', { status: 500 })
			})
		} as unknown as DurableObjectNamespace;

		await expect(assertScanRateLimit(undefined, '203.0.113.1', limiter)).resolves.toBeUndefined();
	});

	it('fails closed on KV errors when configured', async () => {
		const kv = {
			get: vi.fn<() => Promise<string | null>>(async () => {
				throw new Error('kv down');
			}),
			put: vi.fn<(key: string, value: string) => Promise<void>>()
		} as unknown as KVNamespace;

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
