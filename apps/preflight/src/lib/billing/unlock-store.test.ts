import { describe, expect, it } from 'vitest';

import { hasUnlock, legacyUnlockKey, loadUnlock, saveUnlock, unlockKey } from './unlock-store';

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
});
