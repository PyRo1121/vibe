import { createHmac } from 'node:crypto';

import { hasUnlock, loadUnlockBySubscription, saveUnlock } from '$lib/billing/unlock-store';
import { describe, expect, it } from 'vitest';

import { POST } from './+server';

function signPayload(payload: string, secret: string): string {
	const timestamp = String(Math.floor(Date.now() / 1000));
	const signature = createHmac('sha256', secret)
		.update(`${timestamp}.${payload}`, 'utf8')
		.digest('hex');
	return `t=${timestamp},v1=${signature}`;
}

function webhookRequest(payload: string, secret: string): Request {
	return new Request('https://deploylint.com/api/webhooks/stripe', {
		method: 'POST',
		headers: { 'stripe-signature': signPayload(payload, secret) },
		body: payload
	});
}

describe('Stripe webhook route', () => {
	it('does not mark an event duplicate when unlock persistence fails', async () => {
		const secret = 'whsec_test';
		const eventId = 'evt_test_unlock_failure';
		const store = new Map<string, string>();
		const payload = JSON.stringify({
			id: eventId,
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_test_abc',
					payment_status: 'paid',
					status: 'complete',
					metadata: { scan_url: 'https://app.test' }
				}
			}
		});

		const kv = {
			get: async (key: string) => store.get(key) ?? null,
			put: async (key: string, value: string) => {
				if (key.startsWith('unlock:')) throw new Error('unlock store unavailable');
				store.set(key, value);
			}
		} as unknown as KVNamespace;

		await expect(
			POST({
				request: webhookRequest(payload, secret),
				platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
			} as Parameters<typeof POST>[0])
		).rejects.toThrow('unlock store unavailable');

		expect(store.has(`webhook:event:${eventId}`)).toBe(false);
	});

	it('deactivates subscription unlocks when Stripe reports cancellation', async () => {
		const secret = 'whsec_test';
		const store = new Map<string, string>();
		const kv = {
			get: async (key: string) => {
				const raw = store.get(key);
				return raw == null ? null : JSON.parse(raw);
			},
			put: async (key: string, value: string) => {
				store.set(key, value);
			}
		} as unknown as KVNamespace;

		await saveUnlock(kv, 'https://app.test', 'cs_test_abc', {
			customerId: 'cus_123',
			subscriptionId: 'sub_123',
			plan: 'solo'
		});

		const payload = JSON.stringify({
			id: 'evt_subscription_deleted',
			type: 'customer.subscription.deleted',
			data: {
				object: {
					id: 'sub_123',
					customer: 'cus_123'
				}
			}
		});

		const res = await POST({
			request: webhookRequest(payload, secret),
			platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
		} as Parameters<typeof POST>[0]);

		expect(res.status).toBe(200);
		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_abc')).toBe(false);
		expect(await loadUnlockBySubscription(kv, 'sub_123')).toMatchObject({
			active: false,
			status: 'canceled'
		});
	});

	it('marks failed invoices inactive and invoice.paid active again', async () => {
		const secret = 'whsec_test';
		const store = new Map<string, string>();
		const kv = {
			get: async (key: string) => {
				const raw = store.get(key);
				return raw == null ? null : JSON.parse(raw);
			},
			put: async (key: string, value: string) => {
				store.set(key, value);
			}
		} as unknown as KVNamespace;

		await saveUnlock(kv, 'https://app.test', 'cs_test_abc', {
			customerId: 'cus_123',
			subscriptionId: 'sub_123',
			plan: 'solo'
		});

		const failedPayload = JSON.stringify({
			id: 'evt_invoice_failed',
			type: 'invoice.payment_failed',
			data: { object: { id: 'in_failed', customer: 'cus_123', subscription: 'sub_123' } }
		});
		await POST({
			request: webhookRequest(failedPayload, secret),
			platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
		} as Parameters<typeof POST>[0]);

		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_abc')).toBe(false);
		expect(await loadUnlockBySubscription(kv, 'sub_123')).toMatchObject({
			active: false,
			status: 'past_due'
		});

		const paidPayload = JSON.stringify({
			id: 'evt_invoice_paid',
			type: 'invoice.paid',
			data: { object: { id: 'in_paid', customer: 'cus_123', subscription: 'sub_123' } }
		});
		await POST({
			request: webhookRequest(paidPayload, secret),
			platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
		} as Parameters<typeof POST>[0]);

		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_abc')).toBe(true);
		expect(await loadUnlockBySubscription(kv, 'sub_123')).toMatchObject({
			active: true,
			status: 'active'
		});
	});
});
