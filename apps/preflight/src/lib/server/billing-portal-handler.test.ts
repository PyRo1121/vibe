import { describe, expect, it, vi, afterEach } from 'vitest';

import { handleBillingPortalPost } from './billing-portal-handler';

vi.mock('$lib/billing/stripe', () => ({
	createBillingPortalSession: vi.fn<() => Promise<{ id: string; url: string }>>(async () => ({
		id: 'bps_test_abc',
		url: 'https://billing.stripe.com/p/session'
	}))
}));

import { createBillingPortalSession } from '$lib/billing/stripe';

afterEach(() => {
	vi.clearAllMocks();
});

describe('handleBillingPortalPost', () => {
	it('returns 503 when Stripe is not configured', async () => {
		const request = new Request('http://localhost/api/billing/portal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', unlockSessionId: 'cs_test_abc123' })
		});

		await expect(
			handleBillingPortalPost(request, undefined, 'http://localhost')
		).rejects.toMatchObject({ status: 503 });
	});

	it('creates a billing portal session for the paid scan session', async () => {
		const request = new Request('http://localhost/api/billing/portal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', unlockSessionId: 'cs_test_abc123' })
		});

		const res = await handleBillingPortalPost(
			request,
			{
				STRIPE_SECRET_KEY: 'sk_test_x',
				PUBLIC_APP_URL: 'https://deploylint.com'
			} as Env,
			'http://evil.test'
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			id: 'bps_test_abc',
			url: 'https://billing.stripe.com/p/session'
		});
		expect(createBillingPortalSession).toHaveBeenCalledWith({
			sessionId: 'cs_test_abc123',
			scanUrl: 'https://app.test',
			appUrl: 'https://deploylint.com',
			secretKey: 'sk_test_x'
		});
	});

	it('rejects requests without a checkout session id', async () => {
		const request = new Request('http://localhost/api/billing/portal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test' })
		});

		await expect(
			handleBillingPortalPost(
				request,
				{ STRIPE_SECRET_KEY: 'sk_test_x', PUBLIC_APP_URL: 'https://deploylint.com' } as Env,
				'http://evil.test'
			)
		).rejects.toMatchObject({ status: 400 });
	});
});
