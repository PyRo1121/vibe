import { describe, expect, it, vi, afterEach } from 'vitest';
import { handleScanPost } from './scan-handler';

vi.mock('$lib/scan/engine', () => ({
	scanUrl: vi.fn(async () => ({
		url: 'https://app.test',
		finalUrl: 'https://app.test/',
		scannedAt: new Date().toISOString(),
		score: 80,
		verdict: 'go',
		verdictMessage: 'ok',
		checks: [],
		summary: { pass: 1, warn: 0, fail: 0 }
	}))
}));

vi.mock('$lib/billing/stripe', () => ({
	verifyCheckoutSession: vi.fn(async () => true)
}));

vi.mock('$lib/server/resolve-unlock', () => ({
	resolveUnlock: vi.fn(async () => true)
}));

vi.mock('$lib/billing/report', () => ({
	sanitizeReport: vi.fn((report, unlocked) => ({ ...report, unlocked }))
}));

import { scanUrl } from '$lib/scan/engine';
import { resolveUnlock } from '$lib/server/resolve-unlock';

afterEach(() => {
	vi.clearAllMocks();
});

describe('handleScanPost', () => {
	it('returns sanitized report for valid scan', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test' })
		});

		const res = await handleScanPost(request, undefined);
		expect(res.status).toBe(200);
		expect(scanUrl).toHaveBeenCalledWith('https://app.test', expect.any(Object));
	});

	it('unlocks scans without checkout while alpha free unlock is enabled', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test' })
		});

		const res = await handleScanPost(request, undefined);
		const body = (await res.json()) as { unlocked?: boolean };
		expect(body.unlocked).toBe(true);
		expect(resolveUnlock).not.toHaveBeenCalled();
	});

	it('accepts legacy unlock session ids without Stripe while alpha is free', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', unlockSessionId: 'cs_test_abc123' })
		});

		const res = await handleScanPost(request, undefined);
		const body = (await res.json()) as { unlocked?: boolean };
		expect(body.unlocked).toBe(true);
		expect(resolveUnlock).not.toHaveBeenCalled();
	});

	it('stores the report and returns a permalink id when KV is bound', async () => {
		const store = new Map<string, string>();
		const kv = {
			put: async (key: string, value: string) => {
				store.set(key, value);
			},
			get: async () => null
		} as unknown as KVNamespace;

		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test' })
		});

		const res = await handleScanPost(request, { REPORTS: kv } as Env);
		const body = (await res.json()) as { reportId?: string };
		expect(body.reportId).toMatch(/^[a-z0-9]{12}$/);
		expect(store.has(`report:${body.reportId}`)).toBe(true);
	});

	it('returns prior scan history for repeat scans of the same URL', async () => {
		const store = new Map<string, string>();
		const kv = {
			put: async (key: string, value: string) => {
				store.set(key, value);
			},
			get: async (key: string) => {
				const raw = store.get(key);
				return raw == null ? null : JSON.parse(raw);
			}
		} as unknown as KVNamespace;

		const makeRequest = () =>
			new Request('http://localhost/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: 'https://app.test' })
			});

		const first = (await (await handleScanPost(makeRequest(), { REPORTS: kv } as Env)).json()) as {
			reportId?: string;
			history?: Array<{ id: string; score: number }>;
		};
		expect(first.history).toBeUndefined();

		const second = (await (await handleScanPost(makeRequest(), { REPORTS: kv } as Env)).json()) as {
			history?: Array<{ id: string; score: number }>;
		};
		expect(second.history).toHaveLength(1);
		expect(second.history?.[0].id).toBe(first.reportId);
		expect(second.history?.[0].score).toBe(80);
	});

	it('attaches AI copy review to alpha-unlocked scans', async () => {
		const ai = {
			run: async () => ({
				response:
					'{"bullets":["Headline is vague"],"headline":"Better headline","subhead":"Better subhead"}'
			})
		};

		const lockedRes = await handleScanPost(
			new Request('http://localhost/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: 'https://app.test' })
			}),
			{ AI: ai } as unknown as Env
		);
		const locked = (await lockedRes.json()) as {
			aiCopyReview?: { headline: string };
		};
		expect(locked.aiCopyReview?.headline).toBe('Better headline');

		const unlockedRes = await handleScanPost(
			new Request('http://localhost/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: 'https://app.test', unlockSessionId: 'cs_test_abc123' })
			}),
			{ AI: ai, STRIPE_SECRET_KEY: 'sk_test_x' } as unknown as Env
		);
		const unlocked = (await unlockedRes.json()) as {
			aiCopyReview?: { headline: string };
		};
		expect(unlocked.aiCopyReview?.headline).toBe('Better headline');
	});

	it('does not call Stripe unlock verification while alpha free unlock is enabled', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url: 'https://app.test',
				unlockSessionId: 'cs_test_abc123',
				previousScore: 70
			})
		});

		const res = await handleScanPost(request, { STRIPE_SECRET_KEY: 'sk_test_x' } as Env);
		expect(res.status).toBe(200);
		expect(resolveUnlock).not.toHaveBeenCalled();
	});
});
