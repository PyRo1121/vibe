import { DEFAULT_DEPLOYLINT_API } from '@vibe/deploylint-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiBase, fetchScan } from './api.js';
import type { ScanReport } from './types.js';

const ORIGINAL_DEPLOYLINT_API = process.env.DEPLOYLINT_API;
const ORIGINAL_PREFLIGHT_API = process.env.PREFLIGHT_API;
const fetchMock = vi.fn<typeof fetch>();

function scanReport(overrides: Partial<ScanReport> = {}): ScanReport {
	return {
		url: 'https://app.test',
		finalUrl: 'https://app.test/',
		score: 91,
		verdict: 'go',
		verdictMessage: 'Ready',
		summary: { pass: 10, warn: 0, fail: 0 },
		checks: [],
		...overrides
	};
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

beforeEach(() => {
	fetchMock.mockReset();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	process.env.DEPLOYLINT_API = ORIGINAL_DEPLOYLINT_API;
	process.env.PREFLIGHT_API = ORIGINAL_PREFLIGHT_API;
	vi.unstubAllGlobals();
});

describe('apiBase', () => {
	it('uses the shared Deploylint API default when no override is configured', () => {
		delete process.env.DEPLOYLINT_API;
		delete process.env.PREFLIGHT_API;

		expect(apiBase()).toBe(DEFAULT_DEPLOYLINT_API);
	});

	it('prefers DEPLOYLINT_API over PREFLIGHT_API and strips trailing slashes', () => {
		process.env.DEPLOYLINT_API = 'https://primary.test///';
		process.env.PREFLIGHT_API = 'https://legacy.test/';

		expect(apiBase()).toBe('https://primary.test');
	});
});

describe('fetchScan', () => {
	it('posts a normalized scan request with unlock context', async () => {
		process.env.DEPLOYLINT_API = 'https://api.test/';
		fetchMock.mockResolvedValueOnce(jsonResponse(scanReport({ reportId: 'abc12345' })));

		const report = await fetchScan({
			url: ' https://app.test ',
			unlockSessionId: 'cs_live_123',
			previousScore: 72
		});

		expect(report.reportId).toBe('abc12345');
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.test/api/scan',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			})
		);
		const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
		expect(JSON.parse(String(init.body))).toEqual({
			url: 'https://app.test',
			unlockSessionId: 'cs_live_123',
			previousScore: 72
		});
	});

	it('surfaces API error messages from non-2xx responses', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Too many scans' }, 429));

		await expect(fetchScan({ url: 'https://app.test' })).rejects.toThrow('Too many scans');
	});

	it('falls back to HTTP status when error responses are not JSON', async () => {
		fetchMock.mockResolvedValueOnce(new Response('bad gateway', { status: 502 }));

		await expect(fetchScan({ url: 'https://app.test' })).rejects.toThrow('HTTP 502');
	});
});
