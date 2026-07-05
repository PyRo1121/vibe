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

async function isDuplicateWebhookEvent(kv: KVNamespace, eventId: string): Promise<boolean> {
	const key = `webhook:event:${eventId}`;
	try {
		if (await kv.get(key)) return true;
		await kv.put(key, '1', { expirationTtl: WEBHOOK_DEDUP_TTL_SECONDS });
		return false;
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

	if (event.id && platform?.env?.REPORTS) {
		if (await isDuplicateWebhookEvent(platform.env.REPORTS, event.id)) {
			return json({ received: true, duplicate: true });
		}
	}

	if (isCheckoutSessionFulfilled(event)) {
		const session = event.data.object;
		const scanUrl = session.metadata?.scan_url?.trim();
		const sessionId = session.id;
		if (scanUrl && sessionId && platform?.env?.REPORTS) {
			await saveUnlock(platform.env.REPORTS, canonicalScanUrl(scanUrl), sessionId);
		}
		logFunnelEvent('checkout_paid', {});
		return json({ received: true, sessionId: sessionId ?? null });
	}

	return json({ received: true, ignored: event.type });
};

/** Stripe sends GET to verify endpoint exists during setup. */
export const GET: RequestHandler = async () => text('ok');
