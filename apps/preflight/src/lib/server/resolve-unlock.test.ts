import { describe, expect, it, vi, afterEach } from 'vitest';

import { resolveUnlock } from './resolve-unlock';

vi.mock('$lib/billing/stripe', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/billing/stripe')>();
	return {
		...actual,
		verifyCheckoutSession: vi.fn<() => Promise<boolean>>(async () => true)
	};
});

import { verifyCheckoutSession } from '$lib/billing/stripe';

afterEach(() => {
	vi.clearAllMocks();
});

function mockKv() {
	const store = new Map<string, string>();
	return {
		kv: {
			put: async (key: string, value: string) => {
				store.set(key, value);
			},
			get: async (key: string) => {
				const raw = store.get(key);
				return raw == null ? null : JSON.parse(raw);
			}
		} as unknown as KVNamespace
	};
}

describe('resolveUnlock', () => {
	it('returns true from KV without calling Stripe', async () => {
		const { kv } = mockKv();
		const { saveUnlock } = await import('$lib/billing/unlock-store');
		await saveUnlock(kv, 'https://app.test', 'cs_test_cached');

		const ok = await resolveUnlock({
			kv,
			scanUrl: 'https://app.test',
			sessionId: 'cs_test_cached'
		});

		expect(ok).toBe(true);
		expect(verifyCheckoutSession).not.toHaveBeenCalled();
	});

	it('falls back to Stripe and writes KV on success', async () => {
		const { kv } = mockKv();
		const ok = await resolveUnlock({
			kv,
			stripeKey: 'sk_test_x',
			scanUrl: 'https://app.test',
			sessionId: 'cs_test_new'
		});

		expect(ok).toBe(true);
		expect(verifyCheckoutSession).toHaveBeenCalled();
		const { hasUnlock } = await import('$lib/billing/unlock-store');
		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_new')).toBe(true);
	});

	it('returns false when neither KV nor Stripe can verify', async () => {
		vi.mocked(verifyCheckoutSession).mockResolvedValueOnce(false);
		const ok = await resolveUnlock({
			stripeKey: 'sk_test_x',
			scanUrl: 'https://app.test',
			sessionId: 'cs_test_bad'
		});
		expect(ok).toBe(false);
	});
});
