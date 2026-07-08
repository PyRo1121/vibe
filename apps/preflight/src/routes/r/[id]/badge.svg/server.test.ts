import type { ScanReport } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { GET } from './+server';

const REPORT_ID = 'abc123def';
const REPORT = {
	url: 'https://app.test',
	finalUrl: 'https://app.test/',
	score: 92,
	verdict: 'go',
	checks: []
} as unknown as ScanReport;

function fakeKv(report: ScanReport | null = REPORT) {
	return {
		get: async (key: string, type?: string) => {
			expect(key).toBe(`report:${REPORT_ID}`);
			if (!report) return null;
			return type === 'json' ? report : JSON.stringify(report);
		}
	} as unknown as KVNamespace;
}

function getBadge(env: Partial<Env>) {
	return GET({
		params: { id: REPORT_ID },
		platform: { env }
	} as Parameters<typeof GET>[0]);
}

describe('/r/[id]/badge.svg route', () => {
	it('returns 404 when report storage is not configured', async () => {
		await expect(getBadge({})).rejects.toMatchObject({ status: 404 });
	});

	it('returns 404 when the report is missing or expired', async () => {
		await expect(getBadge({ REPORTS: fakeKv(null) })).rejects.toMatchObject({ status: 404 });
	});

	it('serves a cacheable SVG badge for the stored score', async () => {
		const response = await getBadge({ REPORTS: fakeKv() });

		expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
		expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
		await expect(response.text()).resolves.toContain('92/100');
	});
});
