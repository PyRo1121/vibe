import { createHmac } from 'node:crypto';

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
});
