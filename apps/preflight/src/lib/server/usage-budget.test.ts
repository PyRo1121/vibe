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

describe('assertDailyScanBudget', () => {
	it('skips without KV', async () => {
		await expect(assertDailyScanBudget(undefined)).resolves.toBeUndefined();
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
