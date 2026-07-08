import type { ScanReport } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { load } from './+page.server';

const REPORT_ID = 'abc123def';
const REPORT = {
	url: 'https://app.test',
	finalUrl: 'https://app.test/',
	score: 84,
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

function loadReportPage(env: Partial<Env>, origin = 'https://preview.deploylint.test') {
	return load({
		params: { id: REPORT_ID },
		platform: { env },
		url: new URL(`${origin}/r/${REPORT_ID}`)
	} as Parameters<typeof load>[0]);
}

describe('/r/[id] server load', () => {
	it('returns 404 when report storage is not configured', async () => {
		await expect(loadReportPage({})).rejects.toMatchObject({ status: 404 });
	});

	it('returns 404 when the report is missing or expired', async () => {
		await expect(loadReportPage({ REPORTS: fakeKv(null) })).rejects.toMatchObject({
			status: 404
		});
	});

	it('loads the stored public report and configured app URL', async () => {
		await expect(
			loadReportPage({
				REPORTS: fakeKv(),
				PUBLIC_APP_URL: 'https://deploylint.com'
			})
		).resolves.toEqual({
			report: REPORT,
			appUrl: 'https://deploylint.com'
		});
	});

	it('falls back to the current request origin when PUBLIC_APP_URL is absent', async () => {
		await expect(loadReportPage({ REPORTS: fakeKv() })).resolves.toMatchObject({
			appUrl: 'https://preview.deploylint.test'
		});
	});
});
