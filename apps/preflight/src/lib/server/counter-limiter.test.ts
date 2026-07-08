import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CounterLimiter } from './counter-limiter';

interface StoredRecord {
	count: number;
	expiresAt: number;
}

function createLimiter() {
	const records = new Map<string, StoredRecord>();
	const get = vi.fn<(key: string) => Promise<StoredRecord | undefined>>(async (key) =>
		records.get(key)
	);
	const put = vi.fn<(key: string, value: StoredRecord) => Promise<void>>(async (key, value) => {
		records.set(key, value);
	});
	const storage = {
		get,
		put
	};
	const state = { storage } as unknown as DurableObjectState;
	const limiter = new CounterLimiter(state, {} as Env);
	return { limiter, records, storage };
}

async function reserve(
	limiter: CounterLimiter,
	body: { key?: string; limit?: number; windowMs?: number }
) {
	const response = await limiter.fetch(
		new Request('https://limiter.test/reserve', {
			method: 'POST',
			body: JSON.stringify(body)
		})
	);
	const json = await response.json().catch(() => null);
	return { response, json };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-07-05T00:00:00.000Z'));
});

afterEach(() => {
	vi.useRealTimers();
});

describe('CounterLimiter', () => {
	it('rejects non-POST requests', async () => {
		const { limiter } = createLimiter();

		const response = await limiter.fetch(new Request('https://limiter.test/reserve'));

		expect(response.status).toBe(405);
		expect(await response.text()).toBe('Method Not Allowed');
	});

	it('rejects malformed reserve requests', async () => {
		const { limiter } = createLimiter();

		const { response, json } = await reserve(limiter, { key: 'ip', limit: 10 });

		expect(response.status).toBe(400);
		expect(json).toEqual({ error: 'Invalid limiter request' });
	});

	it('allows requests until the window limit is exhausted', async () => {
		const { limiter, storage } = createLimiter();

		await expect(
			reserve(limiter, { key: 'ip:1', limit: 2, windowMs: 60_000 })
		).resolves.toMatchObject({
			json: { allowed: true, remaining: 1 }
		});
		await expect(
			reserve(limiter, { key: 'ip:1', limit: 2, windowMs: 60_000 })
		).resolves.toMatchObject({
			json: { allowed: true, remaining: 0 }
		});
		await expect(
			reserve(limiter, { key: 'ip:1', limit: 2, windowMs: 60_000 })
		).resolves.toMatchObject({
			json: { allowed: false, remaining: 0 }
		});
		expect(storage.put).toHaveBeenCalledTimes(2);
	});

	it('starts a new window after the stored record expires', async () => {
		const { limiter, records } = createLimiter();

		await reserve(limiter, { key: 'ip:1', limit: 1, windowMs: 1_000 });
		await expect(
			reserve(limiter, { key: 'ip:1', limit: 1, windowMs: 1_000 })
		).resolves.toMatchObject({
			json: { allowed: false, remaining: 0 }
		});

		vi.setSystemTime(new Date('2026-07-05T00:00:02.000Z'));

		await expect(
			reserve(limiter, { key: 'ip:1', limit: 1, windowMs: 1_000 })
		).resolves.toMatchObject({
			json: { allowed: true, remaining: 0 }
		});
		expect(records.get('ip:1')?.count).toBe(1);
	});
});
