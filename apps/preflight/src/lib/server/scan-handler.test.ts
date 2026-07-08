import { describe, expect, it, vi, afterEach } from 'vitest';

import { handleScanPost } from './scan-handler';

type ResolveUnlock = typeof import('$lib/server/resolve-unlock').resolveUnlock;
type SanitizeReport = typeof import('$lib/billing/report').sanitizeReport;
type ScanRepo = typeof import('$lib/scan/repo/scan').scanRepo;
type ScanUrl = typeof import('$lib/scan/engine').scanUrl;
type VerifyCheckoutSession = typeof import('$lib/billing/stripe').verifyCheckoutSession;
type AiRun = import('$lib/server/copy-review').AiRunner['run'];
type RecordProjectReport = typeof import('$lib/server/project-reports').recordProjectReport;

function testEnv(overrides: Partial<Env> = {}): Env {
	return overrides as Env;
}

const alphaEnv = testEnv({ DEPLOYLINT_ALPHA_FREE_UNLOCK: 'true' });

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

vi.mock('$lib/server/project-reports', () => ({
	recordProjectReport: vi.fn<RecordProjectReport>(async () => true)
}));

vi.mock('$lib/scan/repo/scan', () => ({
	scanRepo: vi.fn<ScanRepo>(async () => ({
		url: 'https://github.com/acme/shop',
		finalUrl: 'https://github.com/acme/shop',
		scannedAt: new Date().toISOString(),
		score: 72,
		verdict: 'conditional',
		verdictMessage: 'repo needs work',
		checks: [],
		summary: { pass: 1, warn: 0, fail: 0 }
	}))
}));

vi.mock('$lib/billing/report', () => ({
	sanitizeReport: vi.fn<SanitizeReport>((report, unlocked) => ({ ...report, unlocked }))
}));

import { scanUrl } from '$lib/scan/engine';
import { scanRepo } from '$lib/scan/repo/scan';
import { recordProjectReport } from '$lib/server/project-reports';
import { resolveUnlock } from '$lib/server/resolve-unlock';

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
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

	it('keeps scans unlocked by default while the product is free', async () => {
		const res = await handleScanPost(makeScanRequest());
		const body = (await res.json()) as { unlocked?: boolean };
		expect(body.unlocked).toBe(true);
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
		});
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

		const res = await handleScanPost(request, {
			DEPLOYLINT_ALPHA_FREE_UNLOCK: 'false',
			STRIPE_SECRET_KEY: 'sk_test_x'
		} as Env);
		const body = (await res.json()) as { unlocked?: boolean };
		expect(body.unlocked).toBe(true);
		expect(resolveUnlock).toHaveBeenCalledWith({
			kv: undefined,
			stripeKey: 'sk_test_x',
			scanUrl: 'https://app.test',
			sessionId: 'cs_test_abc123'
		});
	});

	it('fails paid unlock requests explicitly when no verifier is configured', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', unlockSessionId: 'cs_test_abc123' })
		});

		await expect(
			handleScanPost(request, { DEPLOYLINT_ALPHA_FREE_UNLOCK: 'false' } as Env)
		).rejects.toMatchObject({
			status: 503,
			body: { message: 'Unlock verification is not configured yet' }
		});
		expect(resolveUnlock).not.toHaveBeenCalled();
	});

	it('routes GitHub repository URLs through the repo scanner', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://github.com/acme/shop/tree/main' })
		});

		const res = await handleScanPost(request, { GITHUB_TOKEN: 'gh_test_token' } as Env);
		const body = (await res.json()) as { finalUrl?: string };

		expect(body.finalUrl).toBe('https://github.com/acme/shop');
		expect(scanRepo).toHaveBeenCalledWith(
			{ owner: 'acme', repo: 'shop' },
			{ token: 'gh_test_token' }
		);
		expect(scanUrl).not.toHaveBeenCalled();
	});

	it('enriches deploy-target CI reports with attached repository evidence', async () => {
		vi.mocked(scanRepo).mockResolvedValueOnce({
			url: 'https://github.com/acme/shop',
			finalUrl: 'https://github.com/acme/shop',
			scannedAt: new Date().toISOString(),
			score: 50,
			verdict: 'conditional',
			verdictMessage: 'repo needs CI hardening',
			repo: {
				owner: 'acme',
				repo: 'shop',
				branch: 'main',
				description: 'Checkout app',
				stars: 12,
				license: 'MIT',
				filesSampled: ['package.json', '.github/workflows/ci.yml'],
				depCount: 4
			},
			checks: [
				{
					id: 'ci-config',
					category: 'launch',
					title: 'CI configured',
					status: 'warn',
					message: 'CI workflow found but quality gates are incomplete.',
					priority: 'p2',
					fixPrompt: 'Add lint, check, test, and build before deploy.'
				}
			],
			summary: { pass: 0, warn: 1, fail: 0 }
		});
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url: 'https://app.test',
				repoUrl: 'github.com/acme/shop',
				projectId: 'proj_live-123',
				ingestToken: 'dlint_ingest_token'
			})
		});

		const res = await handleScanPost(request, { GITHUB_TOKEN: 'gh_test_token' } as Env);
		const body = (await res.json()) as {
			finalUrl?: string;
			repo?: { owner: string; repo: string };
			checks?: Array<{ id: string; title: string; priority?: string }>;
			summary?: { pass: number; warn: number; fail: number };
		};

		expect(body.finalUrl).toBe('https://app.test/');
		expect(body.repo).toMatchObject({ owner: 'acme', repo: 'shop' });
		expect(body.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: 'repo:ci-config',
					title: 'Repo: CI configured',
					priority: 'p2'
				})
			])
		);
		expect(body.summary?.warn).toBeGreaterThanOrEqual(1);
		expect(scanUrl).toHaveBeenCalledWith('https://app.test', expect.any(Object));
		expect(scanRepo).toHaveBeenCalledWith(
			{ owner: 'acme', repo: 'shop' },
			{ token: 'gh_test_token' }
		);
	});

	it('includes attached repository evidence in repeat-scan diffs', async () => {
		const repoBase = {
			url: 'https://github.com/acme/shop',
			finalUrl: 'https://github.com/acme/shop',
			scannedAt: new Date().toISOString(),
			score: 100,
			verdict: 'go' as const,
			verdictMessage: 'repo clean',
			repo: {
				owner: 'acme',
				repo: 'shop',
				branch: 'main',
				description: 'Checkout app',
				stars: 12,
				license: 'MIT',
				filesSampled: ['package.json', '.github/workflows/ci.yml'],
				depCount: 4
			},
			licenseAudit: {
				libraries: [],
				sellable: 'yes' as const,
				summary: 'No dependency license risk found.'
			}
		};
		vi.mocked(scanRepo)
			.mockResolvedValueOnce({
				...repoBase,
				checks: [
					{
						id: 'ci-config',
						category: 'launch',
						title: 'Repo: CI configured',
						status: 'pass',
						message: 'CI has quality gates.',
						fixPrompt: 'Keep CI gates in place.'
					}
				],
				summary: { pass: 1, warn: 0, fail: 0 }
			})
			.mockResolvedValueOnce({
				...repoBase,
				score: 50,
				verdict: 'conditional',
				verdictMessage: 'repo needs CI hardening',
				checks: [
					{
						id: 'ci-config',
						category: 'launch',
						title: 'Repo: CI configured',
						status: 'warn',
						message: 'CI workflow found but quality gates are incomplete.',
						fixPrompt: 'Add lint, check, test, and build before deploy.'
					}
				],
				summary: { pass: 0, warn: 1, fail: 0 }
			});
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
		const requestBody = {
			url: 'https://app.test',
			repoUrl: 'github.com/acme/shop'
		};

		await handleScanPost(
			new Request('http://localhost/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			}),
			{ REPORTS: kv } as Env
		);
		const second = (await (
			await handleScanPost(
				new Request('http://localhost/api/scan', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(requestBody)
				}),
				{ REPORTS: kv } as Env
			)
		).json()) as {
			licenseAudit?: { summary: string };
			scanDiff?: { regressed: string[] };
		};

		expect(second.licenseAudit?.summary).toContain('No dependency license risk');
		expect(second.scanDiff?.regressed).toContain('Repo: CI configured');
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

	it('records workspace-backed CI report context when project id is present', async () => {
		const request = new Request('http://localhost/api/scan', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url: 'https://app.test',
				projectId: 'proj_live-123',
				ingestToken: 'dlint_ingest_token',
				commitSha: 'headabc123',
				branch: 'feature/gate-hardening',
				pullRequest: '42'
			})
		});
		const authDb = {} as D1Database;

		await handleScanPost(request, { AUTH_DB: authDb } as Env);

		expect(recordProjectReport).toHaveBeenCalledWith(
			authDb,
			{
				projectId: 'proj_live-123',
				ingestToken: 'dlint_ingest_token',
				commitSha: 'headabc123',
				branch: 'feature/gate-hardening',
				pullRequest: '42'
			},
			expect.objectContaining({
				finalUrl: 'https://app.test/',
				score: 80,
				verdict: 'go'
			})
		);
	});

	it('attaches copy readiness review only after paid unlock or explicit alpha access', async () => {
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
			{ DEPLOYLINT_ALPHA_FREE_UNLOCK: 'false', AI: ai } as unknown as Env
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
			testEnv({ ...alphaEnv, AI: ai })
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

	it('passes social copy and the top non-passing checks into paid AI review', async () => {
		vi.mocked(scanUrl).mockResolvedValueOnce({
			url: 'https://app.test',
			finalUrl: 'https://app.test/',
			scannedAt: new Date().toISOString(),
			score: 68,
			verdict: 'conditional',
			verdictMessage: 'fix trust gaps',
			socialPreview: {
				title: 'Launch title',
				description: 'Launch description',
				image: null,
				imageUrl: null,
				twitterCard: null,
				ready: false,
				issues: []
			},
			checks: [
				{
					id: 'privacy',
					category: 'legal',
					title: 'Privacy policy',
					status: 'fail',
					message: 'Missing legal trust',
					priority: 'p0',
					fixPrompt: 'Add a privacy policy'
				},
				{
					id: 'checkout',
					category: 'payments',
					title: 'Checkout',
					status: 'warn',
					message: 'No server verification',
					priority: 'p1',
					fixPrompt: 'Verify checkout server-side'
				},
				{
					id: 'favicon',
					category: 'seo',
					title: 'Favicon',
					status: 'pass',
					message: 'Present',
					priority: 'p2',
					fixPrompt: ''
				}
			],
			summary: { pass: 1, warn: 1, fail: 1 }
		});
		const run = vi.fn<AiRun>(async () => ({
			response:
				'{"bullets":["Trust gap is concrete"],"headline":"Ship with trust","subhead":"Fix the proof points before launch."}'
		}));

		const res = await handleScanPost(makeScanRequest(), {
			...alphaEnv,
			AI: { run }
		});
		const body = (await res.json()) as { aiCopyReview?: { headline: string } };
		const options = run.mock.calls[0]?.[1] as { messages?: Array<{ content: string }> };
		const prompt = options.messages?.[0]?.content ?? '';

		expect(body.aiCopyReview?.headline).toBe('Ship with trust');
		expect(prompt).toContain('Current title tag: Launch title');
		expect(prompt).toContain('Current meta description: Launch description');
		expect(prompt).toContain('Privacy policy: Missing legal trust');
		expect(prompt).toContain('Checkout: No server verification');
		expect(prompt).not.toContain('Favicon: Present');
	});

	it('skips paid AI review for blocked scans', async () => {
		vi.mocked(scanUrl).mockResolvedValueOnce({
			url: 'https://app.test',
			finalUrl: 'https://app.test/',
			scannedAt: new Date().toISOString(),
			score: 0,
			verdict: 'no-go',
			verdictMessage: 'blocked',
			scanCoverage: 'blocked',
			checks: [],
			summary: { pass: 0, warn: 0, fail: 1 }
		});
		const run = vi.fn<AiRun>(async () => ({
			response:
				'{"bullets":["Should not run"],"headline":"Blocked","subhead":"Blocked scans skip copy review."}'
		}));

		const res = await handleScanPost(makeScanRequest(), {
			...alphaEnv,
			AI: { run }
		});
		const body = (await res.json()) as { aiCopyReview?: unknown };

		expect(body.aiCopyReview).toBeUndefined();
		expect(run).not.toHaveBeenCalled();
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
		});
		expect(res.status).toBe(200);
		expect(resolveUnlock).not.toHaveBeenCalled();
	});

	it('logs scan start and completion telemetry with coarse target shape', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.mocked(scanUrl).mockResolvedValueOnce({
			url: 'https://app.test',
			finalUrl: 'https://app.test/',
			scannedAt: new Date().toISOString(),
			score: 80,
			verdict: 'go',
			verdictMessage: 'ok',
			checks: [
				{
					id: 'https',
					category: 'security',
					title: 'HTTPS',
					status: 'pass',
					message: 'HTTPS enforced',
					fixPrompt: 'Keep HTTPS enforced.'
				}
			],
			summary: { pass: 1, warn: 0, fail: 0 }
		});
		vi.mocked(scanRepo).mockResolvedValueOnce({
			url: 'https://github.com/acme/shop',
			finalUrl: 'https://github.com/acme/shop',
			scannedAt: new Date().toISOString(),
			score: 80,
			verdict: 'go',
			verdictMessage: 'repo ok',
			checks: [
				{
					id: 'ci-config',
					category: 'launch',
					title: 'CI configured',
					status: 'pass',
					message: 'CI is configured.',
					fixPrompt: 'Keep CI configured.'
				}
			],
			summary: { pass: 1, warn: 0, fail: 0 }
		});

		await handleScanPost(
			new Request('http://localhost/api/scan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: 'https://app.test',
					repoUrl: 'github.com/acme/shop'
				})
			})
		);
		const events = log.mock.calls.map(
			(call) => JSON.parse(String(call[0])) as Record<string, unknown>
		);

		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					event: 'scan_started',
					mode: 'free',
					targetType: 'deploy_and_repo',
					surface: 'api'
				}),
				expect.objectContaining({
					event: 'scan_completed',
					mode: 'free',
					targetType: 'deploy_and_repo',
					scoreBucket: '80-100'
				})
			])
		);
	});

	it('logs capacity exhaustion telemetry without scanning the target', async () => {
		const log = vi.spyOn(console, 'log').mockImplementation(() => {});
		const limiter = {
			idFromName: () => ({ toString: () => 'budget-id' }),
			get: () => ({
				fetch: async () =>
					new Response(JSON.stringify({ allowed: false }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					})
			})
		} as unknown as DurableObjectNamespace;

		await expect(
			handleScanPost(makeScanRequest(), { LIMITER: limiter } as Env)
		).rejects.toMatchObject({
			status: 503
		});
		const events = log.mock.calls.map(
			(call) => JSON.parse(String(call[0])) as Record<string, unknown>
		);

		expect(scanUrl).not.toHaveBeenCalled();
		expect(events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					event: 'scan_started',
					mode: 'free',
					targetType: 'deploy_url'
				}),
				expect.objectContaining({
					event: 'capacity_reached',
					mode: 'free',
					targetType: 'deploy_url',
					reason: 'daily_scan_capacity_reached'
				})
			])
		);
	});
});
