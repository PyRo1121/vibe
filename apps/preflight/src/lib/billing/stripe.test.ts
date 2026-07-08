import { describe, expect, it, vi, afterEach } from 'vitest';

import {
	canonicalScanUrl,
	createBillingPortalSession,
	createCheckoutSession,
	createWorkspaceCheckoutSession,
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
			secretKey: 'sk_test_x',
			plan: 'solo',
			priceId: 'price_solo'
		});

		expect(session.url).toContain('stripe.com');
	});

	it('creates subscription checkout for the selected recurring price', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init?: RequestInit) => {
				const body = init?.body as URLSearchParams;
				expect(body.get('mode')).toBe('subscription');
				expect(body.get('line_items[0][price]')).toBe('price_builder');
				expect(body.get('metadata[plan]')).toBe('builder');
				expect(body.get('metadata[scan_url]')).toBe('https://app.test');
				expect(body.get('subscription_data[metadata][plan]')).toBe('builder');
				expect(body.get('subscription_data[metadata][scan_url]')).toBe('https://app.test');
				expect(body.get('payment_method_types[0]')).toBe('card');
				return {
					ok: true,
					json: async () => ({ id: 'cs_test_abc', url: 'https://checkout.stripe.com/x' })
				};
			})
		);

		await createCheckoutSession({
			scanUrl: 'https://app.test',
			appUrl: 'https://preflight.test',
			secretKey: 'sk_test_x',
			plan: 'builder',
			priceId: 'price_builder'
		});
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
			secretKey: 'sk_test_x',
			plan: 'solo',
			priceId: 'price_solo'
		});
		await createCheckoutSession({
			scanUrl: 'https://app.test',
			appUrl: 'https://preflight.test',
			secretKey: 'sk_test_x',
			plan: 'solo',
			priceId: 'price_solo'
		});

		expect(keys).toHaveLength(2);
		expect(keys[0]).not.toBe(keys[1]);
	});

	it('surfaces Stripe checkout errors without leaking unbounded response bodies', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: false,
				text: async () => 'x'.repeat(300)
			}))
		);

		await expect(
			createCheckoutSession({
				scanUrl: 'https://app.test',
				appUrl: 'https://preflight.test',
				secretKey: 'sk_test_x',
				plan: 'solo',
				priceId: 'price_solo'
			})
		).rejects.toThrow(/^Stripe checkout failed: x{200}$/);
	});

	it('rejects malformed successful checkout responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({ id: 123, url: null })
			}))
		);

		await expect(
			createCheckoutSession({
				scanUrl: 'https://app.test',
				appUrl: 'https://preflight.test',
				secretKey: 'sk_test_x',
				plan: 'solo',
				priceId: 'price_solo'
			})
		).rejects.toThrow('Malformed Stripe checkout session response');
	});
});

describe('createWorkspaceCheckoutSession', () => {
	it('creates subscription checkout with workspace metadata and app return URLs', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init?: RequestInit) => {
				const body = init?.body as URLSearchParams;
				expect(body.get('mode')).toBe('subscription');
				expect(body.get('success_url')).toBe('https://deploylint.com/app?checkout=success');
				expect(body.get('cancel_url')).toBe('https://deploylint.com/app?checkout=cancel');
				expect(body.get('client_reference_id')).toBe('wks_live');
				expect(body.get('customer_email')).toBe('olen@example.com');
				expect(body.get('line_items[0][price]')).toBe('price_builder');
				expect(body.get('metadata[plan]')).toBe('builder');
				expect(body.get('metadata[workspace_id]')).toBe('wks_live');
				expect(body.get('metadata[project_id]')).toBe('proj_live-123');
				expect(body.get('metadata[deploy_url]')).toBe('https://app.test');
				expect(body.get('subscription_data[metadata][workspace_id]')).toBe('wks_live');
				expect(body.get('subscription_data[metadata][project_id]')).toBe('proj_live-123');
				expect(body.get('subscription_data[metadata][deploy_url]')).toBe('https://app.test');
				return {
					ok: true,
					json: async () => ({ id: 'cs_test_workspace', url: 'https://checkout.stripe.com/x' })
				};
			})
		);

		const session = await createWorkspaceCheckoutSession({
			appUrl: 'https://deploylint.com/',
			customerEmail: 'olen@example.com',
			deployUrl: 'https://app.test/',
			plan: 'builder',
			priceId: 'price_builder',
			projectId: 'proj_live-123',
			secretKey: 'sk_test_x',
			workspaceId: 'wks_live'
		});

		expect(session).toEqual({
			id: 'cs_test_workspace',
			url: 'https://checkout.stripe.com/x'
		});
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

	it('rejects sessions that Stripe cannot retrieve', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: false
			}))
		);

		expect(await verifyCheckoutSession('cs_test_missing', 'https://app.test', 'sk_test_x')).toBe(
			false
		);
	});

	it('rejects paid sessions that are not complete', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					payment_status: 'paid',
					status: 'open',
					metadata: { scan_url: 'https://app.test' }
				})
			}))
		);

		expect(await verifyCheckoutSession('cs_test_abc123', 'https://app.test', 'sk_test_x')).toBe(
			false
		);
	});

	it('returns false when Stripe retrieval throws', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new Error('network down');
			})
		);

		expect(await verifyCheckoutSession('cs_test_abc123', 'https://app.test', 'sk_test_x')).toBe(
			false
		);
	});

	it('returns false for malformed successful Stripe retrieval bodies', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					payment_status: 'paid',
					status: 'complete',
					metadata: { scan_url: 123 }
				})
			}))
		);

		expect(await verifyCheckoutSession('cs_test_abc123', 'https://app.test', 'sk_test_x')).toBe(
			false
		);
	});
});

describe('createBillingPortalSession', () => {
	it('creates a customer portal session from a paid checkout session', async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string, init?: RequestInit) => {
				calls.push({ url, init });
				if (url.endsWith('/checkout/sessions/cs_test_abc123')) {
					return {
						ok: true,
						json: async () => ({
							payment_status: 'paid',
							status: 'complete',
							customer: 'cus_123',
							metadata: { scan_url: 'https://app.test' }
						})
					};
				}

				expect(url).toBe('https://api.stripe.com/v1/billing_portal/sessions');
				const body = init?.body as URLSearchParams;
				expect(body.get('customer')).toBe('cus_123');
				expect(body.get('return_url')).toBe(
					'https://deploylint.com/review?billing=return&session_id=cs_test_abc123'
				);
				return {
					ok: true,
					json: async () => ({ id: 'bps_test_123', url: 'https://billing.stripe.com/p/session' })
				};
			})
		);

		const session = await createBillingPortalSession({
			sessionId: 'cs_test_abc123',
			scanUrl: 'https://app.test/',
			appUrl: 'https://deploylint.com',
			secretKey: 'sk_test_x'
		});

		expect(session.url).toBe('https://billing.stripe.com/p/session');
		expect(calls).toHaveLength(2);
	});

	it('rejects checkout sessions without a Stripe customer', async () => {
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

		await expect(
			createBillingPortalSession({
				sessionId: 'cs_test_abc123',
				scanUrl: 'https://app.test',
				appUrl: 'https://deploylint.com',
				secretKey: 'sk_test_x'
			})
		).rejects.toThrow('No Stripe customer');
	});

	it('accepts object-shaped Stripe customers when creating a portal session', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string, init?: RequestInit) => {
				if (url.endsWith('/checkout/sessions/cs_test_abc123')) {
					return {
						ok: true,
						json: async () => ({
							payment_status: 'paid',
							status: 'complete',
							customer: { id: 'cus_object_123' },
							metadata: { scan_url: 'https://app.test' }
						})
					};
				}

				const body = init?.body as URLSearchParams;
				expect(body.get('customer')).toBe('cus_object_123');
				return {
					ok: true,
					json: async () => ({ id: 'bps_test_123', url: 'https://billing.stripe.com/p/session' })
				};
			})
		);

		await expect(
			createBillingPortalSession({
				sessionId: 'cs_test_abc123',
				scanUrl: 'https://app.test/',
				appUrl: 'https://deploylint.com',
				secretKey: 'sk_test_x'
			})
		).resolves.toMatchObject({ id: 'bps_test_123' });
	});

	it('surfaces Stripe portal creation failures', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url.endsWith('/checkout/sessions/cs_test_abc123')) {
					return {
						ok: true,
						json: async () => ({
							payment_status: 'paid',
							status: 'complete',
							customer: 'cus_123',
							metadata: { scan_url: 'https://app.test' }
						})
					};
				}

				return {
					ok: false,
					text: async () => 'portal disabled'
				};
			})
		);

		await expect(
			createBillingPortalSession({
				sessionId: 'cs_test_abc123',
				scanUrl: 'https://app.test',
				appUrl: 'https://deploylint.com',
				secretKey: 'sk_test_x'
			})
		).rejects.toThrow('Stripe billing portal failed: portal disabled');
	});

	it('rejects malformed successful portal responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url.endsWith('/checkout/sessions/cs_test_abc123')) {
					return {
						ok: true,
						json: async () => ({
							payment_status: 'paid',
							status: 'complete',
							customer: 'cus_123',
							metadata: { scan_url: 'https://app.test' }
						})
					};
				}

				return {
					ok: true,
					json: async () => ({ id: 'bps_test_123', url: 42 })
				};
			})
		);

		await expect(
			createBillingPortalSession({
				sessionId: 'cs_test_abc123',
				scanUrl: 'https://app.test',
				appUrl: 'https://deploylint.com',
				secretKey: 'sk_test_x'
			})
		).rejects.toThrow('Malformed Stripe billing portal session response');
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
