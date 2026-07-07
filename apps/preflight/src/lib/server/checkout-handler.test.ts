import { describe, expect, it, vi, afterEach } from 'vitest';

import { handleCheckoutPost } from './checkout-handler';

vi.mock('$lib/billing/stripe', () => ({
	createCheckoutSession: vi.fn<() => Promise<{ id: string; url: string }>>(async () => ({
		id: 'cs_test_abc',
		url: 'https://checkout.stripe.com/x'
	})),
	isStripeLiveMode: vi.fn<(secretKey: string) => boolean>((secretKey) =>
		secretKey.startsWith('sk_live_')
	)
}));

import { createCheckoutSession } from '$lib/billing/stripe';

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
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

	it('logs sanitized Stripe checkout failures for production diagnosis', async () => {
		const request = new Request('http://localhost/api/checkout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', plan: 'builder' })
		});
		vi.mocked(createCheckoutSession).mockRejectedValueOnce(
			new Error('Stripe checkout failed: No such price')
		);
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			handleCheckoutPost(
				request,
				{
					STRIPE_SECRET_KEY: 'sk_test_x',
					PUBLIC_APP_URL: 'https://deploylint.com',
					STRIPE_PRICE_BUILDER: 'price_builder'
				} as Env,
				'http://evil.test'
			)
		).rejects.toMatchObject({ status: 502 });

		expect(consoleError).toHaveBeenCalledWith(
			'deploylint.checkout.failed',
			expect.objectContaining({
				plan: 'builder',
				stripeMode: 'test',
				message: 'Stripe checkout failed: No such price'
			})
		);
	});

	it('logs live-mode non-Error checkout failures without leaking secrets', async () => {
		const request = new Request('http://localhost/api/checkout', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url: 'https://app.test', plan: 'solo' })
		});
		vi.mocked(createCheckoutSession).mockRejectedValueOnce('Stripe unavailable');
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			handleCheckoutPost(
				request,
				{
					STRIPE_SECRET_KEY: 'sk_live_x',
					PUBLIC_APP_URL: 'https://deploylint.com',
					STRIPE_PRICE_SOLO: 'price_solo'
				} as Env,
				'http://evil.test'
			)
		).rejects.toMatchObject({ status: 502 });

		expect(consoleError).toHaveBeenCalledWith(
			'deploylint.checkout.failed',
			expect.objectContaining({
				plan: 'solo',
				priceEnv: 'STRIPE_PRICE_SOLO',
				stripeMode: 'live',
				message: 'Stripe unavailable'
			})
		);
		expect(JSON.stringify(consoleError.mock.calls)).not.toContain('sk_live_x');
	});
});
