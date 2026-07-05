import { describe, expect, it, vi } from 'vitest';
import {
	assertDailyScanBudget,
	assertPlausibleEventBudget,
	FREE_TIER_LIMITS,
	reserveAiCopyReview
} from './usage-budget';

function fakeKv(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	return {
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
		}),
		store
	} as unknown as KVNamespace & { store: Map<string, string> };
}

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

describe('assertDailyScanBudget', () => {
	it('skips without KV', async () => {
		await expect(assertDailyScanBudget(undefined)).resolves.toBeUndefined();
	});

	it('uses the limiter binding for concurrent daily scan budget', async () => {
		const limiter = fakeLimiter();
		const attempts = await Promise.allSettled(
			Array.from({ length: FREE_TIER_LIMITS.scansPerDay + 1 }, () =>
				assertDailyScanBudget(undefined, limiter)
			)
		);

		expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(
			FREE_TIER_LIMITS.scansPerDay
		);
		expect(
			attempts.filter((r) => r.status === 'rejected' && 'reason' in r && r.reason.status === 503)
		).toHaveLength(1);
	});

	it('blocks at the daily scan cap', async () => {
		const kv = fakeKv({ [`budget:scans:${new Date().toISOString().slice(0, 10)}`]: '175' });
		await expect(assertDailyScanBudget(kv)).rejects.toMatchObject({ status: 503 });
	});
});

describe('reserveAiCopyReview', () => {
	it('returns false when the daily AI cap is reached', async () => {
		const kv = fakeKv({ [`budget:ai:${new Date().toISOString().slice(0, 10)}`]: '25' });
		await expect(reserveAiCopyReview(kv)).resolves.toBe(false);
	});

	it('uses the limiter binding for daily AI budget', async () => {
		const limiter = fakeLimiter();
		const attempts = await Promise.all(
			Array.from({ length: FREE_TIER_LIMITS.aiCopyReviewsPerDay + 1 }, () =>
				reserveAiCopyReview(undefined, limiter)
			)
		);

		expect(attempts.filter(Boolean)).toHaveLength(FREE_TIER_LIMITS.aiCopyReviewsPerDay);
		expect(attempts.at(-1)).toBe(false);
	});

	it('increments under the cap', async () => {
		const kv = fakeKv();
		await expect(reserveAiCopyReview(kv)).resolves.toBe(true);
		const day = new Date().toISOString().slice(0, 10);
		expect(kv.store.get(`budget:ai:${day}`)).toBe('1');
	});
});

describe('assertPlausibleEventBudget', () => {
	it('blocks abusive event volume per IP', async () => {
		const d = new Date();
		const bucket = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
		const kv = fakeKv({ [`budget:plausible:203.0.113.1:${bucket}`]: '120' });
		await expect(assertPlausibleEventBudget(kv, '203.0.113.1')).rejects.toMatchObject({
			status: 429
		});
	});
});

describe('FREE_TIER_LIMITS', () => {
	it('keeps scan cap under KV write budget', () => {
		expect(FREE_TIER_LIMITS.scansPerDay * 4).toBeLessThan(1000);
	});
});
