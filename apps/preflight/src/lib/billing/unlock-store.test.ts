import { stableStorageKey } from '$lib/server/storage-key';
import { describe, expect, it } from 'vitest';

import {
	hasUnlock,
	legacyUnlockKey,
	loadUnlock,
	loadUnlockBySubscription,
	saveUnlock,
	setUnlockStatusBySubscription,
	unlockKey
} from './unlock-store';

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
		} as unknown as KVNamespace,
		store
	};
}

function subscriptionIndexKey(subscriptionId: string): string {
	return stableStorageKey('subscription', subscriptionId);
}

describe('unlockKey', () => {
	it('normalizes trailing slashes', () => {
		expect(unlockKey('https://app.test/')).toBe(unlockKey('https://app.test'));
		expect(legacyUnlockKey('https://app.test/')).toBe('unlock:https://app.test');
	});

	it('uses a short KV-safe hashed key for long URLs', () => {
		const key = unlockKey(`https://app.test/${'a'.repeat(1000)}`);
		expect(key).toMatch(/^unlock:[a-f0-9]{64}$/);
		expect(new TextEncoder().encode(key).byteLength).toBeLessThanOrEqual(512);
	});
});

describe('saveUnlock / hasUnlock', () => {
	it('stores and matches session id for the same URL', async () => {
		const { kv } = mockKv();
		await saveUnlock(kv, 'https://app.test/', 'cs_test_abc');
		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_abc')).toBe(true);
		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_other')).toBe(false);
	});

	it('returns null when no record exists', async () => {
		const { kv } = mockKv();
		expect(await loadUnlock(kv, 'https://app.test')).toBeNull();
	});

	it('returns null when KV reads fail', async () => {
		const kv = {
			get: async () => {
				throw new Error('kv read failed');
			}
		} as unknown as KVNamespace;

		await expect(loadUnlock(kv, 'https://app.test')).resolves.toBeNull();
	});

	it('reads legacy URL-derived unlock keys during migration', async () => {
		const { kv, store } = mockKv();
		store.set(
			legacyUnlockKey('https://app.test'),
			JSON.stringify({ sessionId: 'cs_test_legacy', paidAt: '2026-07-05T00:00:00.000Z' })
		);

		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_legacy')).toBe(true);
	});

	it('surfaces KV write failures so webhook fulfillment can retry', async () => {
		const kv = {
			put: async () => {
				throw new Error('kv unavailable');
			}
		} as unknown as KVNamespace;

		await expect(saveUnlock(kv, 'https://app.test', 'cs_test_abc')).rejects.toThrow(
			'kv unavailable'
		);
	});

	it('indexes subscription unlocks and can deactivate/reactivate access', async () => {
		const { kv } = mockKv();
		await saveUnlock(kv, 'https://app.test/', 'cs_test_abc', {
			customerId: 'cus_123',
			subscriptionId: 'sub_123',
			plan: 'solo'
		});

		expect(await loadUnlockBySubscription(kv, 'sub_123')).toMatchObject({
			sessionId: 'cs_test_abc',
			scanUrl: 'https://app.test',
			customerId: 'cus_123',
			subscriptionId: 'sub_123',
			plan: 'solo',
			active: true,
			status: 'active'
		});
		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_abc')).toBe(true);

		await setUnlockStatusBySubscription(kv, 'sub_123', {
			active: false,
			status: 'past_due'
		});
		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_abc')).toBe(false);
		expect(await loadUnlockBySubscription(kv, 'sub_123')).toMatchObject({
			active: false,
			status: 'past_due'
		});

		await setUnlockStatusBySubscription(kv, 'sub_123', {
			active: true,
			status: 'active'
		});
		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_abc')).toBe(true);
	});

	it('ignores malformed or stale subscription indexes', async () => {
		const { kv, store } = mockKv();
		store.set(
			subscriptionIndexKey('sub_missing_scan'),
			JSON.stringify({ sessionId: 'cs_test_abc' })
		);
		store.set(
			subscriptionIndexKey('sub_missing_session'),
			JSON.stringify({ scanUrl: 'https://app.test' })
		);
		store.set(
			subscriptionIndexKey('sub_missing_record'),
			JSON.stringify({ scanUrl: 'https://app.test', sessionId: 'cs_test_abc' })
		);

		await saveUnlock(kv, 'https://other.test', 'cs_test_other', {
			subscriptionId: 'sub_mismatch'
		});
		store.set(
			subscriptionIndexKey('sub_mismatch'),
			JSON.stringify({ scanUrl: 'https://other.test', sessionId: 'cs_test_wrong' })
		);

		await expect(loadUnlockBySubscription(kv, 'sub_missing_scan')).resolves.toBeNull();
		await expect(loadUnlockBySubscription(kv, 'sub_missing_session')).resolves.toBeNull();
		await expect(loadUnlockBySubscription(kv, 'sub_missing_record')).resolves.toBeNull();
		await expect(loadUnlockBySubscription(kv, 'sub_mismatch')).resolves.toBeNull();
	});

	it('returns false when subscription status updates have no unlock record', async () => {
		const { kv } = mockKv();

		await expect(
			setUnlockStatusBySubscription(kv, 'sub_missing', {
				active: false,
				status: 'canceled'
			})
		).resolves.toBe(false);
	});
});
