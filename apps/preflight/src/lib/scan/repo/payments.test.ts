import { describe, expect, it } from 'vitest';

import { analyzeBillingReadiness } from './payments';
import type { PackageManifestEvidence, RepoFileEvidence } from './readiness';

function manifest(dependencies: Record<string, string> = {}): PackageManifestEvidence {
	return {
		path: 'package.json',
		json: { dependencies }
	};
}

function file(path: string, text: string): RepoFileEvidence {
	return { path, text };
}

function byId(findings: ReturnType<typeof analyzeBillingReadiness>) {
	return Object.fromEntries(findings.map((finding) => [finding.id, finding]));
}

describe('repo payment readiness analyzer', () => {
	it('returns no findings when no payment provider is detected', () => {
		expect(
			analyzeBillingReadiness(
				[manifest({ '@sveltejs/kit': '^2.0.0' })],
				[file('src/routes/api/webhooks/github/+server.ts', 'export const POST = () => {};')]
			)
		).toEqual([]);
	});

	it('fails client-only Stripe checkout as not server-owned', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ '@stripe/stripe-js': '^7.0.0' })],
				[
					file(
						'src/routes/checkout/+page.ts',
						`
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_123');
await stripe?.redirectToCheckout({ lineItems: [{ price: 'price_123' }] });
`
					)
				]
			)
		);

		expect(findings['checkout-server-owned']).toMatchObject({
			status: 'fail',
			category: 'payments',
			launchImpact: 'blocker'
		});
	});

	it('passes server-side Stripe checkout session creation', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/api/checkout/+server.ts',
						"await stripe.checkout.sessions.create({ mode: 'subscription', line_items: [] });"
					)
				]
			)
		);

		expect(findings['checkout-server-owned']).toMatchObject({ status: 'pass' });
	});

	it('passes server-side payment intent creation as checkout ownership', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/api/payments/+server.ts',
						'await stripe.paymentIntents.create({ amount: 2000, currency: "usd" });'
					)
				]
			)
		);

		expect(findings['checkout-server-owned']).toMatchObject({ status: 'pass' });
	});

	it('does not pass checkout ownership from a billing portal route alone', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/account/billing/+server.ts',
						'await stripe.billingPortal.sessions.create({ customer, return_url });'
					)
				]
			)
		);

		expect(findings['checkout-server-owned']).toMatchObject({ status: 'warn' });
		expect(findings['billing-portal']).toMatchObject({ status: 'pass' });
	});

	it('fails client-only Stripe checkout even when a billing portal route exists', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0', '@stripe/stripe-js': '^7.0.0' })],
				[
					file(
						'src/routes/checkout/+page.ts',
						`
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_123');
await stripe?.redirectToCheckout({ lineItems: [{ price: 'price_123' }] });
`
					),
					file(
						'src/routes/account/billing/+server.ts',
						'await stripe.billingPortal.sessions.create({ customer, return_url });'
					)
				]
			)
		);

		expect(findings['checkout-server-owned']).toMatchObject({
			status: 'fail',
			launchImpact: 'blocker'
		});
		expect(findings['billing-portal']).toMatchObject({ status: 'pass' });
	});

	it('fails webhook handlers without signature verification', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/api/webhooks/stripe/+server.ts',
						`
export async function POST({ request }) {
  const event = await request.json();
  if (event.type === 'checkout.session.completed') return new Response('ok');
}
`
					)
				]
			)
		);

		expect(findings['webhook-signature-missing']).toMatchObject({
			status: 'fail',
			category: 'payments',
			launchImpact: 'blocker'
		});
	});

	it('fails webhook handlers that reference a webhook secret without constructEvent verification', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/api/webhooks/stripe/+server.ts',
						`
export async function POST({ request, locals }) {
  const event = await request.json();
  const secret = locals.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('Missing webhook secret');
  if (event.type === 'checkout.session.completed') return new Response('ok');
}
`
					)
				]
			)
		);

		expect(findings['webhook-signature-missing']).toMatchObject({
			status: 'fail',
			launchImpact: 'blocker'
		});
	});

	it('passes webhook handlers that verify raw body signatures with the env secret', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/api/webhooks/stripe/+server.ts',
						`
const signature = request.headers.get('stripe-signature');
const raw = await request.text();
const event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
`
					)
				]
			)
		);

		expect(findings['webhook-signature-missing']).toMatchObject({ status: 'pass' });
	});

	it('warns when webhook handling only covers checkout completion', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/api/webhooks/stripe/+server.ts',
						"if (event.type === 'checkout.session.completed') await markPaid(event.data.object);"
					)
				]
			)
		);

		expect(findings['webhook-event-coverage']).toMatchObject({
			status: 'warn',
			launchImpact: 'fix-soon'
		});
	});

	it('passes webhook event coverage for success, async success, failed payment, and cancellation events', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/api/webhooks/stripe/+server.ts',
						`
switch (event.type) {
  case 'checkout.session.completed':
  case 'checkout.session.async_payment_succeeded':
  case 'invoice.payment_failed':
  case 'customer.subscription.deleted':
    break;
}
`
					)
				]
			)
		);

		expect(findings['webhook-event-coverage']).toMatchObject({ status: 'pass' });
	});

	it('warns when webhook completion has no access update signal', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/api/webhooks/stripe/+server.ts',
						"if (event.type === 'checkout.session.completed') return new Response('ok');"
					)
				]
			)
		);

		expect(findings['entitlement-fulfillment']).toMatchObject({ status: 'warn' });
	});

	it('passes entitlement fulfillment when access is granted and revoked', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/api/webhooks/stripe/+server.ts',
						`
if (event.type === 'checkout.session.completed') await grantAccess(event.data.object.customer);
if (event.type === 'customer.subscription.deleted') await revokeAccess(event.data.object.customer);
`
					)
				]
			)
		);

		expect(findings['entitlement-fulfillment']).toMatchObject({ status: 'pass' });
	});

	it('passes when a Stripe billing portal session is created', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/routes/account/billing/+server.ts',
						'await stripe.billingPortal.sessions.create({ customer, return_url });'
					)
				]
			)
		);

		expect(findings['billing-portal']).toMatchObject({ status: 'pass' });
	});

	it('fails live secret literals in payment files', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[
					file(
						'src/lib/server/stripe.ts',
						"const stripe = new Stripe('sk_live_12345678901234567890');"
					)
				]
			)
		);

		expect(findings['payment-env-safety']).toMatchObject({
			status: 'fail',
			category: 'payments',
			launchImpact: 'blocker'
		});
	});

	it('passes secret key usage through environment bindings', () => {
		const findings = byId(
			analyzeBillingReadiness(
				[manifest({ stripe: '^20.0.0' })],
				[file('src/lib/server/stripe.ts', 'const stripe = new Stripe(env.STRIPE_SECRET_KEY);')]
			)
		);

		expect(findings['payment-env-safety']).toMatchObject({ status: 'pass' });
	});
});
