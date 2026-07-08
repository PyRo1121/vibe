import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = fileURLToPath(new URL('../../', import.meta.url));
const scripts = [
	'scripts/setup-stripe.ps1',
	'scripts/setup-stripe-live.ps1',
	'scripts/setup-deploylint-store-live.mjs'
].map((path) => readFileSync(join(appRoot, path), 'utf8'));

const handledWebhookEvents = [
	'checkout.session.completed',
	'checkout.session.async_payment_succeeded',
	'checkout.session.async_payment_failed',
	'invoice.payment_failed',
	'invoice.paid',
	'customer.subscription.deleted'
];

describe('Stripe setup scripts', () => {
	it('subscribe webhooks to the billing lifecycle handled by the Worker', () => {
		for (const script of scripts) {
			for (const event of handledWebhookEvents) {
				expect(script).toContain(event);
			}
		}
	});
});
