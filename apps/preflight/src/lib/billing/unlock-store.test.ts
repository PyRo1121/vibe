import { describe, expect, it } from 'vitest';
import { hasUnlock, loadUnlock, saveUnlock, unlockKey } from './unlock-store';

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
		expect(unlockKey('https://app.test/')).toBe('unlock:https://app.test');
		expect(unlockKey('https://app.test')).toBe('unlock:https://app.test');
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
});
