import { createHmac, timingSafeEqual } from 'node:crypto';

/** Stripe default webhook tolerance — see https://docs.stripe.com/webhooks/signatures */
export const WEBHOOK_TOLERANCE_SECONDS = 300;
export const MAX_WEBHOOK_BYTES = 256 * 1024;

export function verifyStripeWebhookSignature(
	payload: string,
	signatureHeader: string | null,
	secret: string
): boolean {
	if (!signatureHeader) return false;

	const parts = new Map<string, string[]>();
	for (const segment of signatureHeader.split(',')) {
		const [key, value] = segment.split('=');
		if (!key || !value) continue;
		const list = parts.get(key) ?? [];
		list.push(value);
		parts.set(key, list);
	}

	const timestamps = parts.get('t') ?? [];
	const signatures = parts.get('v1') ?? [];
	const timestamp = timestamps[0];
	if (!timestamp || signatures.length === 0) return false;

	const timestampSeconds = Number.parseInt(timestamp, 10);
	if (!Number.isFinite(timestampSeconds)) return false;

	const age = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
	if (age > WEBHOOK_TOLERANCE_SECONDS) return false;

	const signedPayload = `${timestamp}.${payload}`;
	const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
	const expectedBuf = Buffer.from(expected, 'hex');

	for (const signature of signatures) {
		try {
			const sigBuf = Buffer.from(signature, 'hex');
			if (expectedBuf.length !== sigBuf.length) continue;
			if (timingSafeEqual(expectedBuf, sigBuf)) return true;
		} catch {
			/* try next signature */
		}
	}

	return false;
}

export interface StripeCheckoutSessionObject {
	id?: string;
	payment_status?: string;
	status?: string;
	metadata?: { scan_url?: string };
}

export interface StripeWebhookEvent {
	type: string;
	data: {
		object: StripeCheckoutSessionObject;
	};
}

export function parseStripeWebhookEvent(payload: string): StripeWebhookEvent {
	return JSON.parse(payload) as StripeWebhookEvent;
}

/** Fulfillment signal per Stripe delayed-payment docs. */
export function isCheckoutSessionFulfilled(event: StripeWebhookEvent): boolean {
	const session = event.data.object;

	if (event.type === 'checkout.session.async_payment_succeeded') {
		return true;
	}

	if (event.type !== 'checkout.session.completed') {
		return false;
	}

	return session.payment_status === 'paid' && session.status === 'complete';
}

/** @deprecated use isCheckoutSessionFulfilled */
export function isPaidCheckoutCompleted(event: StripeWebhookEvent): boolean {
	return isCheckoutSessionFulfilled(event);
}
