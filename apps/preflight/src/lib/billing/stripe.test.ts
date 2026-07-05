import { describe, expect, it, vi, afterEach } from 'vitest';
import {
	canonicalScanUrl,
	createCheckoutSession,
	isStripeLiveMode,
	verifyCheckoutSession
} from './stripe';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('createCheckoutSession', () => {
	it('returns session url from Stripe', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init?: RequestInit) => {
				expect(init?.headers).toMatchObject({
					'Idempotency-Key': expect.any(String)
				});
				return {
					ok: true,
					json: async () => ({ id: 'cs_test_abc', url: 'https://checkout.stripe.com/x' })
				};
			})
		);

		const session = await createCheckoutSession({
			scanUrl: 'https://app.test',
			appUrl: 'https://preflight.test',
			secretKey: 'sk_test_x'
		});

		expect(session.url).toContain('stripe.com');
	});

	it('uses a fresh idempotency key for repeated checkout attempts on the same URL', async () => {
		const keys: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init?: RequestInit) => {
				const headers = init?.headers as Record<string, string>;
				keys.push(headers['Idempotency-Key']);
				return {
					ok: true,
					json: async () => ({ id: 'cs_test_abc', url: 'https://checkout.stripe.com/x' })
				};
			})
		);

		await createCheckoutSession({
			scanUrl: 'https://app.test',
			appUrl: 'https://preflight.test',
			secretKey: 'sk_test_x'
		});
		await createCheckoutSession({
			scanUrl: 'https://app.test',
			appUrl: 'https://preflight.test',
			secretKey: 'sk_test_x'
		});

		expect(keys).toHaveLength(2);
		expect(keys[0]).not.toBe(keys[1]);
	});
});

describe('verifyCheckoutSession', () => {
	it('accepts paid sessions with matching metadata', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					payment_status: 'paid',
					status: 'complete',
					metadata: { scan_url: 'https://app.test' }
				})
			}))
		);

		expect(await verifyCheckoutSession('cs_test_abc123', 'https://app.test', 'sk_test_x')).toBe(
			true
		);
	});

	it('matches bare domains to canonical https metadata', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					payment_status: 'paid',
					status: 'complete',
					metadata: { scan_url: 'https://app.test' }
				})
			}))
		);

		expect(await verifyCheckoutSession('cs_test_abc123', 'app.test', 'sk_test_x')).toBe(true);
	});

	it('rejects invalid session ids', async () => {
		expect(await verifyCheckoutSession('bad', 'https://app.test', 'sk_test_x')).toBe(false);
	});

	it('rejects unpaid sessions', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({ payment_status: 'unpaid', metadata: {} })
			}))
		);

		expect(await verifyCheckoutSession('cs_test_abc123', 'https://app.test', 'sk_test_x')).toBe(
			false
		);
	});

	it('rejects paid sessions without scan_url metadata', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({ payment_status: 'paid', metadata: {} })
			}))
		);

		expect(await verifyCheckoutSession('cs_test_abc123', 'https://app.test', 'sk_test_x')).toBe(
			false
		);
	});

	it('rejects paid sessions with mismatched metadata', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					payment_status: 'paid',
					metadata: { scan_url: 'https://other.test' }
				})
			}))
		);

		expect(await verifyCheckoutSession('cs_test_abc123', 'https://app.test', 'sk_test_x')).toBe(
			false
		);
	});
});

describe('isStripeLiveMode', () => {
	it('returns true for sk_live_ keys', () => {
		expect(isStripeLiveMode('sk_live_abc123')).toBe(true);
	});

	it('returns false for sk_test_ keys', () => {
		expect(isStripeLiveMode('sk_test_abc123')).toBe(false);
	});

	it('returns false for empty or unknown prefixes', () => {
		expect(isStripeLiveMode('')).toBe(false);
		expect(isStripeLiveMode('pk_live_abc')).toBe(false);
	});
});

describe('canonicalScanUrl', () => {
	it('normalizes bare domains to https without trailing slash', () => {
		expect(canonicalScanUrl('app.test/')).toBe('https://app.test');
	});
});
