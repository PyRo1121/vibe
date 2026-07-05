import { json, error, text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	isCheckoutSessionFulfilled,
	MAX_WEBHOOK_BYTES,
	parseStripeWebhookEvent,
	verifyStripeWebhookSignature
} from '$lib/billing/webhook';
import { canonicalScanUrl } from '$lib/billing/stripe';
import { saveUnlock } from '$lib/billing/unlock-store';
import { requireStripeWebhookSecretKey } from '$lib/server/env';
import { logFunnelEvent } from '$lib/metrics/funnel';

const WEBHOOK_DEDUP_TTL_SECONDS = 60 * 60 * 24 * 7;

async function hasWebhookEvent(kv: KVNamespace, eventId: string): Promise<boolean> {
	const key = `webhook:event:${eventId}`;
	try {
		return Boolean(await kv.get(key));
	} catch {
		error(503, 'Webhook processing temporarily unavailable');
	}
}

async function markWebhookEventProcessed(kv: KVNamespace, eventId: string): Promise<void> {
	const key = `webhook:event:${eventId}`;
	try {
		await kv.put(key, '1', { expirationTtl: WEBHOOK_DEDUP_TTL_SECONDS });
	} catch {
		error(503, 'Webhook processing temporarily unavailable');
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
			await saveUnlock(reports, canonicalScanUrl(scanUrl), sessionId);
		}
		if (event.id && reports) await markWebhookEventProcessed(reports, event.id);
		logFunnelEvent('checkout_paid', {});
		return json({ received: true, sessionId: sessionId ?? null });
	}

	if (event.id && reports) await markWebhookEventProcessed(reports, event.id);
	return json({ received: true, ignored: event.type });
};

/** Stripe sends GET to verify endpoint exists during setup. */
export const GET: RequestHandler = async () => text('ok');
