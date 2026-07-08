import { createHmac } from 'node:crypto';

import { hasUnlock, loadUnlockBySubscription, saveUnlock } from '$lib/billing/unlock-store';
import { MAX_WEBHOOK_BYTES } from '$lib/billing/webhook';
import { describe, expect, it } from 'vitest';

import { GET, POST } from './+server';

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

interface D1Call {
	sql: string;
	values: unknown[];
	method: 'run';
}

class FakeStatement {
	private values: unknown[] = [];

	constructor(
		private readonly db: FakeD1,
		private readonly sql: string
	) {}

	bind(...values: unknown[]): FakeStatement {
		this.values = values;
		return this;
	}

	async run(): Promise<unknown> {
		this.db.calls.push({ sql: this.sql, values: this.values, method: 'run' });
		return { success: true };
	}
}

class FakeD1 {
	calls: D1Call[] = [];

	prepare(sql: string): FakeStatement {
		return new FakeStatement(this, sql);
	}
}

describe('Stripe webhook route', () => {
	it('rejects invalid webhook envelopes before processing', async () => {
		const secret = 'whsec_test';
		await expect(
			POST({
				request: new Request('https://deploylint.com/api/webhooks/stripe', {
					method: 'POST',
					headers: { 'stripe-signature': 'bad' },
					body: JSON.stringify({ id: 'evt_bad_signature' })
				}),
				platform: { env: { STRIPE_WEBHOOK_SECRET: secret } }
			} as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 400 });

		const invalidPayload = '{not-json';
		await expect(
			POST({
				request: webhookRequest(invalidPayload, secret),
				platform: { env: { STRIPE_WEBHOOK_SECRET: secret } }
			} as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 400 });

		await expect(
			POST({
				request: new Request('https://deploylint.com/api/webhooks/stripe', {
					method: 'POST',
					body: 'x'.repeat(MAX_WEBHOOK_BYTES + 1)
				}),
				platform: { env: { STRIPE_WEBHOOK_SECRET: secret } }
			} as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 413 });
	});

	it('rejects signed webhook payloads without a valid event envelope', async () => {
		const secret = 'whsec_test';
		const malformedEnvelope = JSON.stringify({ id: 'evt_bad_shape', type: 'invoice.paid' });

		await expect(
			POST({
				request: webhookRequest(malformedEnvelope, secret),
				platform: { env: { STRIPE_WEBHOOK_SECRET: secret } }
			} as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 400 });
	});

	it('returns duplicate without reprocessing already seen Stripe events', async () => {
		const secret = 'whsec_test';
		const eventId = 'evt_duplicate';
		const store = new Map<string, string>([[`webhook:event:${eventId}`, '1']]);
		const payload = JSON.stringify({
			id: eventId,
			type: 'invoice.paid',
			data: { object: { id: 'in_paid', subscription: 'sub_123' } }
		});
		const kv = {
			get: async (key: string) => store.get(key) ?? null,
			put: async (key: string, value: string) => store.set(key, value)
		} as unknown as KVNamespace;

		const response = await POST({
			request: webhookRequest(payload, secret),
			platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
		} as Parameters<typeof POST>[0]);

		expect(await response.json()).toEqual({ received: true, duplicate: true });
	});

	it('fails closed when webhook de-dup storage cannot be read', async () => {
		const secret = 'whsec_test';
		const payload = JSON.stringify({
			id: 'evt_dedup_unavailable',
			type: 'invoice.paid',
			data: { object: { id: 'in_paid', subscription: 'sub_123' } }
		});
		const kv = {
			get: async () => {
				throw new Error('kv down');
			},
			put: async () => {}
		} as unknown as KVNamespace;

		await expect(
			POST({
				request: webhookRequest(payload, secret),
				platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
			} as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 503 });
	});

	it('persists a fulfilled checkout event and marks it processed', async () => {
		const secret = 'whsec_test';
		const eventId = 'evt_checkout_paid';
		const store = new Map<string, string>();
		const payload = JSON.stringify({
			id: eventId,
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_test_paid',
					customer: { id: 'cus_123' },
					subscription: { id: 'sub_123' },
					payment_status: 'paid',
					status: 'complete',
					metadata: { plan: 'builder', scan_url: 'https://app.test/' }
				}
			}
		});
		const kv = {
			get: async (key: string) => {
				const raw = store.get(key);
				return raw == null ? null : JSON.parse(raw);
			},
			put: async (key: string, value: string) => {
				store.set(key, value);
			}
		} as unknown as KVNamespace;

		const response = await POST({
			request: webhookRequest(payload, secret),
			platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
		} as Parameters<typeof POST>[0]);

		expect(await response.json()).toEqual({ received: true, sessionId: 'cs_test_paid' });
		expect(await hasUnlock(kv, 'https://app.test/', 'cs_test_paid')).toBe(true);
		expect(store.has(`webhook:event:${eventId}`)).toBe(true);
	});

	it('persists a fulfilled workspace checkout event to D1 subscription state', async () => {
		const secret = 'whsec_test';
		const eventId = 'evt_workspace_checkout_paid';
		const store = new Map<string, string>();
		const db = new FakeD1();
		const payload = JSON.stringify({
			id: eventId,
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_test_workspace',
					customer: { id: 'cus_workspace' },
					subscription: { id: 'sub_workspace' },
					payment_status: 'paid',
					status: 'complete',
					metadata: {
						plan: 'builder',
						workspace_id: 'wks_live',
						project_id: 'proj_live-123',
						deploy_url: 'https://app.test/'
					}
				}
			}
		});
		const kv = {
			get: async (key: string) => store.get(key) ?? null,
			put: async (key: string, value: string) => {
				store.set(key, value);
			}
		} as unknown as KVNamespace;

		const response = await POST({
			request: webhookRequest(payload, secret),
			platform: {
				env: {
					AUTH_DB: db as unknown as D1Database,
					REPORTS: kv,
					STRIPE_WEBHOOK_SECRET: secret
				}
			}
		} as Parameters<typeof POST>[0]);

		expect(await response.json()).toEqual({ received: true, sessionId: 'cs_test_workspace' });
		expect(db.calls).toEqual([
			expect.objectContaining({
				sql: expect.stringContaining('INSERT INTO subscription'),
				values: [
					'sub_wks_live',
					'wks_live',
					'cus_workspace',
					'sub_workspace',
					'builder',
					expect.any(Number),
					expect.any(Number)
				]
			})
		]);
		expect(store.has(`webhook:event:${eventId}`)).toBe(true);
	});

	it('accepts a fulfilled checkout event even when report storage is absent', async () => {
		const secret = 'whsec_test';
		const payload = JSON.stringify({
			id: 'evt_checkout_without_reports',
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_test_no_reports',
					payment_status: 'paid',
					status: 'complete',
					metadata: { scan_url: 'https://app.test/' }
				}
			}
		});

		const response = await POST({
			request: webhookRequest(payload, secret),
			platform: { env: { STRIPE_WEBHOOK_SECRET: secret } }
		} as Parameters<typeof POST>[0]);

		expect(await response.json()).toEqual({ received: true, sessionId: 'cs_test_no_reports' });
	});

	it('acknowledges paid checkout events with malformed metadata without granting access', async () => {
		const secret = 'whsec_test';
		const store = new Map<string, string>();
		const payload = JSON.stringify({
			id: 'evt_checkout_bad_metadata',
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_test_bad_metadata',
					payment_status: 'paid',
					status: 'complete',
					metadata: { scan_url: 123 }
				}
			}
		});
		const kv = {
			get: async (key: string) => {
				const raw = store.get(key);
				return raw == null ? null : JSON.parse(raw);
			},
			put: async (key: string, value: string) => {
				store.set(key, value);
			}
		} as unknown as KVNamespace;

		const response = await POST({
			request: webhookRequest(payload, secret),
			platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
		} as Parameters<typeof POST>[0]);

		expect(await response.json()).toEqual({
			received: true,
			sessionId: 'cs_test_bad_metadata'
		});
		expect(await hasUnlock(kv, 'https://app.test', 'cs_test_bad_metadata')).toBe(false);
		expect(store.has('webhook:event:evt_checkout_bad_metadata')).toBe(true);
	});

	it('fails closed when webhook processed markers cannot be written', async () => {
		const secret = 'whsec_test';
		const payload = JSON.stringify({
			id: 'evt_marker_unavailable',
			type: 'checkout.session.completed',
			data: {
				object: {
					id: 'cs_test_marker',
					payment_status: 'paid',
					status: 'complete',
					metadata: { scan_url: 'https://app.test/' }
				}
			}
		});
		const kv = {
			get: async (key: string) => (key.startsWith('webhook:event:') ? null : null),
			put: async (key: string) => {
				if (key.startsWith('webhook:event:')) throw new Error('kv marker down');
			}
		} as unknown as KVNamespace;

		await expect(
			POST({
				request: webhookRequest(payload, secret),
				platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
			} as Parameters<typeof POST>[0])
		).rejects.toMatchObject({ status: 503 });
	});

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

	it('updates D1 workspace subscription status from invoice events', async () => {
		const secret = 'whsec_test';
		const db = new FakeD1();
		const payload = JSON.stringify({
			id: 'evt_workspace_invoice_failed',
			type: 'invoice.payment_failed',
			data: { object: { id: 'in_failed', customer: 'cus_123', subscription: 'sub_workspace' } }
		});

		const response = await POST({
			request: webhookRequest(payload, secret),
			platform: {
				env: {
					AUTH_DB: db as unknown as D1Database,
					STRIPE_WEBHOOK_SECRET: secret
				}
			}
		} as Parameters<typeof POST>[0]);

		expect(await response.json()).toEqual({
			received: true,
			ignored: 'invoice.payment_failed'
		});
		expect(db.calls).toEqual([
			expect.objectContaining({
				sql: expect.stringContaining('WHERE stripe_subscription_id = ?'),
				values: ['past_due', expect.any(Number), 'sub_workspace']
			})
		]);
	});

	it('marks async checkout payment failures inactive by subscription id', async () => {
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
			subscriptionId: 'sub_async',
			plan: 'builder'
		});

		const payload = JSON.stringify({
			id: 'evt_async_failed',
			type: 'checkout.session.async_payment_failed',
			data: { object: { id: 'cs_async_failed', subscription: { id: 'sub_async' } } }
		});
		const response = await POST({
			request: webhookRequest(payload, secret),
			platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
		} as Parameters<typeof POST>[0]);

		expect(await response.json()).toEqual({
			received: true,
			ignored: 'checkout.session.async_payment_failed'
		});
		expect(await loadUnlockBySubscription(kv, 'sub_async')).toMatchObject({
			active: false,
			status: 'past_due'
		});
	});

	it('marks ignored events processed when no subscription id is present', async () => {
		const secret = 'whsec_test';
		const eventId = 'evt_ignored_without_subscription';
		const store = new Map<string, string>();
		const kv = {
			get: async (key: string) => store.get(key) ?? null,
			put: async (key: string, value: string) => {
				store.set(key, value);
			}
		} as unknown as KVNamespace;
		const payload = JSON.stringify({
			id: eventId,
			type: 'invoice.finalized',
			data: { object: { id: 'in_finalized' } }
		});

		const response = await POST({
			request: webhookRequest(payload, secret),
			platform: { env: { STRIPE_WEBHOOK_SECRET: secret, REPORTS: kv } }
		} as Parameters<typeof POST>[0]);

		expect(await response.json()).toEqual({ received: true, ignored: 'invoice.finalized' });
		expect(store.has(`webhook:event:${eventId}`)).toBe(true);
	});

	it('serves a plain setup probe response for Stripe endpoint checks', async () => {
		const response = await GET({} as Parameters<typeof GET>[0]);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('ok');
	});
});
