import { describe, expect, it } from 'vitest';
import {
	appendHistory,
	computeScanDiff,
	historyKey,
	issueMap,
	loadReport,
	newReportId,
	saveReport
} from './report-store';
import type { ScanReport } from '$lib/scan/types';

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
			}
		} as unknown as KVNamespace
	};
}

const REPORT = { url: 'https://app.test', score: 88, checks: [] } as unknown as ScanReport;

describe('report store', () => {
	it('generates url-safe ids', () => {
		const id = newReportId();
		expect(id).toMatch(/^[a-z0-9]{12}$/);
		expect(newReportId()).not.toBe(id);
	});

	it('round-trips a report', async () => {
		const { kv } = fakeKv();
		const id = await saveReport(kv, REPORT);
		expect(id).toBeTruthy();
		const loaded = await loadReport(kv, id as string);
		expect(loaded?.url).toBe('https://app.test');
		expect(loaded?.score).toBe(88);
	});

	it('rejects malformed ids without hitting KV', async () => {
		const { kv } = fakeKv();
		expect(await loadReport(kv, '../../etc/passwd')).toBeNull();
		expect(await loadReport(kv, 'UPPER-CASE!!')).toBeNull();
		expect(await loadReport(kv, 'nonexistent99')).toBeNull();
	});

	it('keys history by host and path, ignoring trailing slash', () => {
		expect(historyKey('https://app.test/')).toBe('history:app.test');
		expect(historyKey('https://app.test/docs/')).toBe('history:app.test/docs');
		expect(historyKey('not a url')).toBeNull();
	});

	it('appends history and returns prior entries oldest-first', async () => {
		const { kv } = fakeKv();
		const entry = (n: number) => ({
			id: `id${n}`,
			score: 70 + n,
			verdict: 'go',
			at: `2026-07-0${n}T00:00:00Z`
		});

		expect(await appendHistory(kv, 'https://app.test/', entry(1))).toEqual([]);
		expect(await appendHistory(kv, 'https://app.test/', entry(2))).toEqual([entry(1)]);
		expect(await appendHistory(kv, 'https://app.test/', entry(3))).toEqual([entry(1), entry(2)]);
	});

	it('caps history at 20 entries', async () => {
		const { kv, store } = fakeKv();
		for (let i = 0; i < 25; i += 1) {
			await appendHistory(kv, 'https://app.test/', {
				id: `id${i}`,
				score: i,
				verdict: 'go',
				at: 'x'
			});
		}
		const saved = JSON.parse(store.get('history:app.test') as string) as unknown[];
		expect(saved).toHaveLength(20);
	});

	it('builds a compact issue map of non-passing checks', () => {
		expect(
			issueMap([
				{ id: 'a', status: 'pass' },
				{ id: 'b', status: 'fail' },
				{ id: 'c', status: 'warn' }
			])
		).toEqual({ b: 'fail', c: 'warn' });
	});

	it('computes fixed and regressed checks between scans', () => {
		const diff = computeScanDiff({ 'meta-description': 'fail', 'og-image-live': 'warn' }, [
			{ id: 'meta-description', status: 'pass', title: 'Meta description' },
			{ id: 'og-image-live', status: 'warn', title: 'OG image reachable' },
			{ id: 'privacy-policy', status: 'fail', title: 'Privacy policy link' },
			{ id: 'canonical', status: 'pass', title: 'Canonical URL' }
		]);
		expect(diff).toEqual({ fixed: ['Meta description'], regressed: ['Privacy policy link'] });
	});

	it('returns null diff when nothing changed', () => {
		expect(computeScanDiff({ a: 'fail' }, [{ id: 'a', status: 'fail', title: 'A' }])).toBeNull();
	});

	it('returns null when KV throws instead of breaking the scan', async () => {
		const broken = {
			put: async () => {
				throw new Error('kv down');
			},
			get: async () => {
				throw new Error('kv down');
			}
		} as unknown as KVNamespace;
		expect(await saveReport(broken, REPORT)).toBeNull();
		expect(await loadReport(broken, 'abcdefgh1234')).toBeNull();
	});
});
