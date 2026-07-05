import { describe, expect, it, vi, afterEach } from 'vitest';
import { handleCheckoutPost } from './checkout-handler';

vi.mock('$lib/billing/stripe', () => ({
	createCheckoutSession: vi.fn(async () => ({
		id: 'cs_test_abc',
		url: 'https://checkout.stripe.com/x'
	}))
}));

import { createCheckoutSession } from '$lib/billing/stripe';

afterEach(() => {
	vi.clearAllMocks();
});

describe('handleCheckoutPost', () => {
	it('returns 503 when Stripe is not configured', async () => {
		const request = new Request('http://localhost/api/checkout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test' })
		});

		await expect(handleCheckoutPost(request, undefined, 'http://localhost')).rejects.toMatchObject({
			status: 503
		});
	});

	it('creates checkout session when configured', async () => {
		const request = new Request('http://localhost/api/checkout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', plan: 'builder' })
		});

		const res = await handleCheckoutPost(
			request,
			{
				STRIPE_SECRET_KEY: 'sk_test_x',
				PUBLIC_APP_URL: 'https://deploylint.com',
				STRIPE_PRICE_BUILDER: 'price_builder'
			} as Env,
			'http://evil.test'
		);

		expect(res.status).toBe(200);
		expect(createCheckoutSession).toHaveBeenCalledWith({
			scanUrl: 'https://app.test',
			appUrl: 'https://deploylint.com',
			secretKey: 'sk_test_x',
			plan: 'builder',
			priceId: 'price_builder'
		});
	});

	it('fails closed when the selected plan has no Stripe price id configured', async () => {
		const request = new Request('http://localhost/api/checkout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', plan: 'agency' })
		});

		await expect(
			handleCheckoutPost(
				request,
				{ STRIPE_SECRET_KEY: 'sk_test_x', PUBLIC_APP_URL: 'https://deploylint.com' } as Env,
				'http://evil.test'
			)
		).rejects.toMatchObject({ status: 503 });
	});
});
