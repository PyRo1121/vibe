import { describe, expect, it, vi, afterEach } from 'vitest';

import { handleScanPost } from './scan-handler';

type ResolveUnlock = typeof import('$lib/server/resolve-unlock').resolveUnlock;
type SanitizeReport = typeof import('$lib/billing/report').sanitizeReport;
type ScanUrl = typeof import('$lib/scan/engine').scanUrl;
type VerifyCheckoutSession = typeof import('$lib/billing/stripe').verifyCheckoutSession;

const alphaEnv = { DEPLOYLINT_ALPHA_FREE_UNLOCK: 'true' } as Env;

vi.mock('$lib/scan/engine', () => ({
	scanUrl: vi.fn<ScanUrl>(async () => ({
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
	verifyCheckoutSession: vi.fn<VerifyCheckoutSession>(async () => true)
}));

vi.mock('$lib/server/resolve-unlock', () => ({
	resolveUnlock: vi.fn<ResolveUnlock>(async () => true)
}));

vi.mock('$lib/billing/report', () => ({
	sanitizeReport: vi.fn<SanitizeReport>((report, unlocked) => ({ ...report, unlocked }))
}));

import { scanUrl } from '$lib/scan/engine';
import { resolveUnlock } from '$lib/server/resolve-unlock';

afterEach(() => {
	vi.clearAllMocks();
});

function makeScanRequest() {
	return new Request('http://localhost/api/scan', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url: 'https://app.test' })
	});
}

describe('handleScanPost', () => {
	it('does not reserve scan budget for invalid requests', async () => {
		const writes: string[] = [];
		const kv = {
			get: async () => null,
			put: async (key: string) => {
				writes.push(key);
			}
		} as unknown as KVNamespace;

		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{"url":'
		});

		await expect(handleScanPost(request, { REPORTS: kv } as Env)).rejects.toMatchObject({
			status: 400
		});
		expect(writes).toEqual([]);
		expect(scanUrl).not.toHaveBeenCalled();
	});

	it('returns sanitized report for valid scan', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test' })
		});

		const res = await handleScanPost(request);
		expect(res.status).toBe(200);
		expect(scanUrl).toHaveBeenCalledWith('https://app.test', expect.any(Object));
	});

	it('keeps scans locked by default until checkout is verified', async () => {
		const res = await handleScanPost(makeScanRequest());
		const body = (await res.json()) as { unlocked?: boolean };
		expect(body.unlocked).toBe(false);
		expect(resolveUnlock).not.toHaveBeenCalled();
	});

	it('keeps scans unlocked while free access is active', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test' })
		});

		const res = await handleScanPost(request, alphaEnv);
		const body = (await res.json()) as { unlocked?: boolean };
		expect(body.unlocked).toBe(true);
		expect(resolveUnlock).not.toHaveBeenCalled();
	});

	it('does not require checkout verification while free access is active', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', unlockSessionId: 'cs_test_abc123' })
		});

		const res = await handleScanPost(request, {
			...alphaEnv,
			STRIPE_SECRET_KEY: 'sk_test_x'
		} as Env);
		const body = (await res.json()) as { unlocked?: boolean };
		expect(body.unlocked).toBe(true);
		expect(resolveUnlock).not.toHaveBeenCalled();
	});

	it('uses checkout verification when a paid scan has an unlock session', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', unlockSessionId: 'cs_test_abc123' })
		});

		const res = await handleScanPost(request, { STRIPE_SECRET_KEY: 'sk_test_x' } as Env);
		const body = (await res.json()) as { unlocked?: boolean };
		expect(body.unlocked).toBe(true);
		expect(resolveUnlock).toHaveBeenCalledWith({
			kv: undefined,
			stripeKey: 'sk_test_x',
			scanUrl: 'https://app.test',
			sessionId: 'cs_test_abc123'
		});
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

		const first = (await (
			await handleScanPost(makeScanRequest(), { REPORTS: kv } as Env)
		).json()) as {
			reportId?: string;
			history?: Array<{ id: string; score: number }>;
		};
		expect(first.history).toBeUndefined();

		const second = (await (
			await handleScanPost(makeScanRequest(), { REPORTS: kv } as Env)
		).json()) as {
			history?: Array<{ id: string; score: number }>;
		};
		expect(second.history).toHaveLength(1);
		expect(second.history?.[0].id).toBe(first.reportId);
		expect(second.history?.[0].score).toBe(80);
	});

	it('attaches AI copy review only after paid unlock or explicit alpha access', async () => {
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
		expect(locked.aiCopyReview).toBeUndefined();

		const alphaRes = await handleScanPost(
			new Request('http://localhost/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: 'https://app.test' })
			}),
			{ ...alphaEnv, AI: ai } as unknown as Env
		);
		const alpha = (await alphaRes.json()) as {
			aiCopyReview?: { headline: string };
		};
		expect(alpha.aiCopyReview?.headline).toBe('Better headline');

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

	it('uses alpha access for re-scan score deltas without checkout verification', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url: 'https://app.test',
				unlockSessionId: 'cs_test_abc123',
				previousScore: 70
			})
		});

		const res = await handleScanPost(request, {
			...alphaEnv,
			STRIPE_SECRET_KEY: 'sk_test_x'
		} as Env);
		expect(res.status).toBe(200);
		expect(resolveUnlock).not.toHaveBeenCalled();
	});
});
