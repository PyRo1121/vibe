import { describe, expect, it } from 'vitest';

import {
	deleteMonitorTarget,
	listMonitorTargets,
	loadSecuritySnapshot,
	monitorTargetKey,
	recordMonitorEvent,
	saveSecuritySnapshot,
	upsertMonitorTarget
} from './monitor-store';
import type { SecuritySnapshot } from './security-diff';

function fakeKv() {
	const store = new Map<string, string>();
	return {
		store,
		kv: {
			put: async (key: string, value: string) => {
				store.set(key, value);
			},
			get: async (key: string, type?: string) => {
				const raw = store.get(key);
				if (raw == null) return null;
				return type === 'json' ? JSON.parse(raw) : raw;
			},
			delete: async (key: string) => {
				store.delete(key);
			}
		} as unknown as KVNamespace
	};
}

const SNAPSHOT: SecuritySnapshot = {
	url: 'https://app.test',
	finalUrl: 'https://app.test/',
	scannedAt: '2026-07-05T00:00:00.000Z',
	score: 88,
	issues: [
		{
			id: 'dependency-vulns',
			title: 'Dependency CVEs',
			status: 'fail',
			message: '1 vulnerable package (worst: high)',
			severity: 'high'
		}
	]
};

describe('monitor store', () => {
	it('normalizes URLs and collapses duplicate targets for an owner', async () => {
		const { kv } = fakeKv();
		const first = await upsertMonitorTarget(kv, {
			ownerKey: 'alpha:anon',
			url: 'HTTPS://APP.TEST/',
			now: '2026-07-05T00:00:00.000Z'
		});
		const second = await upsertMonitorTarget(kv, {
			ownerKey: 'alpha:anon',
			url: 'https://app.test',
			now: '2026-07-06T00:00:00.000Z'
		});

		expect(first?.id).toBe(second?.id);
		expect(second?.normalizedUrl).toBe('https://app.test/');
		expect(second?.createdAt).toBe('2026-07-05T00:00:00.000Z');
		expect(second?.updatedAt).toBe('2026-07-06T00:00:00.000Z');
		expect(second?.plan).toBe('alpha-free');
		expect(second?.notifications.enabled).toBe(true);
	});

	it('lists targets by owner only', async () => {
		const { kv } = fakeKv();
		const owned = await upsertMonitorTarget(kv, {
			ownerKey: 'alpha:one',
			url: 'https://one.test',
			now: '2026-07-05T00:00:00.000Z'
		});
		await upsertMonitorTarget(kv, {
			ownerKey: 'alpha:two',
			url: 'https://two.test',
			now: '2026-07-05T00:00:00.000Z'
		});

		const targets = await listMonitorTargets(kv, 'alpha:one');

		expect(targets.map((target) => target.id)).toEqual([owned?.id]);
	});

	it('deletes a target and removes it from the owner index', async () => {
		const { kv, store } = fakeKv();
		const target = await upsertMonitorTarget(kv, {
			ownerKey: 'alpha:anon',
			url: 'https://app.test',
			now: '2026-07-05T00:00:00.000Z'
		});

		expect(await deleteMonitorTarget(kv, 'alpha:anon', target?.id as string)).toBe(true);
		expect(await listMonitorTargets(kv, 'alpha:anon')).toEqual([]);
		expect(store.has(monitorTargetKey(target?.id as string))).toBe(false);
	});

	it('round-trips the last security snapshot', async () => {
		const { kv } = fakeKv();

		await saveSecuritySnapshot(kv, 'target123', SNAPSHOT);

		expect(await loadSecuritySnapshot(kv, 'target123')).toEqual(SNAPSHOT);
	});

	it('records newest monitor events first and caps history', async () => {
		const { kv } = fakeKv();
		for (let i = 0; i < 25; i += 1) {
			await recordMonitorEvent(kv, 'target123', {
				id: `event${i}`,
				targetId: 'target123',
				createdAt: `2026-07-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
				type: 'new-issues',
				issueIds: [`issue${i}`]
			});
		}

		const events = await recordMonitorEvent(kv, 'target123', {
			id: 'event25',
			targetId: 'target123',
			createdAt: '2026-07-26T00:00:00.000Z',
			type: 'resolved',
			issueIds: ['issue25']
		});

		expect(events).toHaveLength(20);
		expect(events[0].id).toBe('event25');
		expect(events.at(-1)?.id).toBe('event6');
	});
});
