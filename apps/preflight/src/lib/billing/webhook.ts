import { createHmac, timingSafeEqual } from 'node:crypto';

/** Stripe default webhook tolerance — see https://docs.stripe.com/webhooks/signatures */
const WEBHOOK_TOLERANCE_SECONDS = 300;
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
	metadata?: {
		deploy_url?: string;
		plan?: string;
		project_id?: string;
		scan_url?: string;
		workspace_id?: string;
	};
	customer?: string | { id?: string };
	subscription?: string | { id?: string };
}

export interface StripeWebhookEvent {
	id?: string;
	type: string;
	data: {
		object: StripeCheckoutSessionObject;
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function stripeObjectId(value: unknown): string | { id: string } | undefined {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (isRecord(value) && typeof value.id === 'string' && value.id.trim()) {
		return { id: value.id.trim() };
	}
	return undefined;
}

function stripeMetadata(value: unknown): StripeCheckoutSessionObject['metadata'] | undefined {
	if (!isRecord(value)) return undefined;

	const metadata: StripeCheckoutSessionObject['metadata'] = {};
	if (typeof value.deploy_url === 'string') metadata.deploy_url = value.deploy_url;
	if (typeof value.scan_url === 'string') metadata.scan_url = value.scan_url;
	if (typeof value.plan === 'string') metadata.plan = value.plan;
	if (typeof value.project_id === 'string') metadata.project_id = value.project_id;
	if (typeof value.workspace_id === 'string') metadata.workspace_id = value.workspace_id;
	return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function stripeSessionObject(value: unknown): StripeCheckoutSessionObject | null {
	if (!isRecord(value)) return null;

	return {
		id: typeof value.id === 'string' ? value.id : undefined,
		payment_status: typeof value.payment_status === 'string' ? value.payment_status : undefined,
		status: typeof value.status === 'string' ? value.status : undefined,
		metadata: stripeMetadata(value.metadata),
		customer: stripeObjectId(value.customer),
		subscription: stripeObjectId(value.subscription)
	};
}

export function parseStripeWebhookEvent(payload: string): StripeWebhookEvent {
	const parsed: unknown = JSON.parse(payload);
	if (!isRecord(parsed) || typeof parsed.type !== 'string') {
		throw new Error('Invalid Stripe webhook event');
	}

	const data = isRecord(parsed.data) ? parsed.data : null;
	const object = stripeSessionObject(data?.object);
	if (!data || !object) {
		throw new Error('Invalid Stripe webhook event');
	}

	return {
		id: typeof parsed.id === 'string' ? parsed.id : undefined,
		type: parsed.type,
		data: { object }
	};
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
