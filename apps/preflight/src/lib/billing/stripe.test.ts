import { describe, expect, it, vi, afterEach } from 'vitest';
import { canonicalScanUrl, createCheckoutSession, verifyCheckoutSession } from './stripe';

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

describe('canonicalScanUrl', () => {
	it('normalizes bare domains to https without trailing slash', () => {
		expect(canonicalScanUrl('app.test/')).toBe('https://app.test');
	});
});
