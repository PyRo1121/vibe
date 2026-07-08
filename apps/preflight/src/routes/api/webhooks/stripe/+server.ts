import { canonicalScanUrl } from '$lib/billing/stripe';
import { saveUnlock, setUnlockStatusBySubscription } from '$lib/billing/unlock-store';
import {
	isCheckoutSessionFulfilled,
	MAX_WEBHOOK_BYTES,
	parseStripeWebhookEvent,
	verifyStripeWebhookSignature
} from '$lib/billing/webhook';
import { logFunnelEvent } from '$lib/metrics/funnel';
import { requireStripeWebhookSecretKey } from '$lib/server/env';
import { json, error, text } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

const WEBHOOK_DEDUP_TTL_SECONDS = 60 * 60 * 24 * 7;

function stripeObjectId(value: string | { id?: string } | undefined): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (typeof value === 'object' && typeof value.id === 'string' && value.id.trim()) {
		return value.id.trim();
	}
	return null;
}

function eventSubscriptionId(event: ReturnType<typeof parseStripeWebhookEvent>): string | null {
	const object = event.data.object;
	if (event.type.startsWith('customer.subscription.')) return stripeObjectId(object.id);
	return stripeObjectId(object.subscription);
}

async function hasWebhookEvent(kv: KVNamespace, eventId: string): Promise<boolean> {
	const key = `webhook:event:${eventId}`;
	try {
		return Boolean(await kv.get(key));
	} catch {
		return error(503, 'Webhook processing temporarily unavailable');
	}
}

async function markWebhookEventProcessed(kv: KVNamespace, eventId: string): Promise<void> {
	const key = `webhook:event:${eventId}`;
	try {
		await kv.put(key, '1', { expirationTtl: WEBHOOK_DEDUP_TTL_SECONDS });
	} catch {
		return error(503, 'Webhook processing temporarily unavailable');
	}
}

export const POST: RequestHandler = async ({ request, platform }) => {
	const webhookSecret = requireStripeWebhookSecretKey(platform?.env);

	const payload = await request.text();
	if (payload.length > MAX_WEBHOOK_BYTES) {
		error(413, 'Webhook payload too large');
	}

	const signature = request.headers.get('stripe-signature');

	if (!verifyStripeWebhookSignature(payload, signature, webhookSecret)) {
		error(400, 'Invalid webhook signature');
	}

	let event;
	try {
		event = parseStripeWebhookEvent(payload);
	} catch {
		error(400, 'Invalid webhook payload');
	}

	const reports = platform?.env?.REPORTS;
	if (event.id && reports) {
		if (await hasWebhookEvent(reports, event.id)) {
			return json({ received: true, duplicate: true });
		}
	}

	if (isCheckoutSessionFulfilled(event)) {
		const session = event.data.object;
		const scanUrl = session.metadata?.scan_url?.trim();
		const sessionId = session.id;
		if (scanUrl && sessionId && reports) {
			await saveUnlock(reports, canonicalScanUrl(scanUrl), sessionId, {
				customerId: stripeObjectId(session.customer) ?? undefined,
				subscriptionId: stripeObjectId(session.subscription) ?? undefined,
				plan: session.metadata?.plan
			});
		}
		if (event.id && reports) await markWebhookEventProcessed(reports, event.id);
		logFunnelEvent('checkout_paid', {});
		return json({ received: true, sessionId: sessionId ?? null });
	}

	if (reports) {
		const subscriptionId = eventSubscriptionId(event);
		if (subscriptionId) {
			if (
				event.type === 'invoice.payment_failed' ||
				event.type === 'checkout.session.async_payment_failed'
			) {
				await setUnlockStatusBySubscription(reports, subscriptionId, {
					active: false,
					status: 'past_due'
				});
				logFunnelEvent('checkout_payment_failed', {});
			} else if (event.type === 'customer.subscription.deleted') {
				await setUnlockStatusBySubscription(reports, subscriptionId, {
					active: false,
					status: 'canceled'
				});
				logFunnelEvent('checkout_subscription_canceled', {});
			} else if (event.type === 'invoice.paid') {
				await setUnlockStatusBySubscription(reports, subscriptionId, {
					active: true,
					status: 'active'
				});
			}
		}
	}

	if (event.id && reports) await markWebhookEventProcessed(reports, event.id);
	return json({ received: true, ignored: event.type });
};

/** Stripe sends GET to verify endpoint exists during setup. */
export const GET: RequestHandler = async () => text('ok');
