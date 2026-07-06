import { createHash, randomUUID } from 'node:crypto';

import type { DeploylintPlanId } from '$lib/product/plans';
import { assertPublicHttpUrl } from '$lib/scan/url-guard';

const STRIPE_API = 'https://api.stripe.com/v1';

/** True when the secret key is a live-mode key (`sk_live_…`). */
export function isStripeLiveMode(secretKey: string): boolean {
	return secretKey.startsWith('sk_live_');
}

/** Normalize scan URLs for Stripe metadata and unlock verification. */
export function canonicalScanUrl(raw: string): string {
	return assertPublicHttpUrl(raw).href.replace(/\/$/, '');
}

export interface CheckoutSession {
	id: string;
	url: string;
}

export interface BillingPortalSession {
	id: string;
	url: string;
}

interface StripeCheckoutSessionResponse {
	id?: string;
	payment_status?: string;
	status?: string;
	metadata?: { scan_url?: string };
	customer?: string | { id?: string };
}

function isCheckoutSessionId(sessionId: string): boolean {
	return /^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId);
}

function stripeObjectId(value: string | { id?: string } | undefined): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (typeof value === 'object' && typeof value.id === 'string' && value.id.trim()) {
		return value.id.trim();
	}
	return null;
}

function checkoutIdempotencyKey(scanUrl: string): string {
	const urlHash = createHash('sha256').update(canonicalScanUrl(scanUrl)).digest('hex').slice(0, 16);
	return `checkout-${urlHash}-${randomUUID()}`;
}

export async function createCheckoutSession(opts: {
	scanUrl: string;
	appUrl: string;
	secretKey: string;
	plan: DeploylintPlanId;
	priceId: string;
}): Promise<CheckoutSession> {
	const { scanUrl, appUrl, secretKey, plan, priceId } = opts;
	const successUrl = `${appUrl.replace(/\/$/, '')}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
	const cancelUrl = `${appUrl.replace(/\/$/, '')}/?checkout=cancel`;
	const canonicalUrl = canonicalScanUrl(scanUrl).slice(0, 500);

	const body = new URLSearchParams({
		mode: 'subscription',
		success_url: successUrl,
		cancel_url: cancelUrl,
		allow_promotion_codes: 'true',
		// Keep fulfillment on card-first Checkout while unlocks are session-based.
		'payment_method_types[0]': 'card',
		'line_items[0][quantity]': '1',
		'line_items[0][price]': priceId,
		'metadata[plan]': plan,
		'metadata[scan_url]': canonicalUrl,
		'subscription_data[metadata][plan]': plan,
		'subscription_data[metadata][scan_url]': canonicalUrl
	});

	const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secretKey}`,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Idempotency-Key': checkoutIdempotencyKey(scanUrl)
		},
		body
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Stripe checkout failed: ${text.slice(0, 200)}`);
	}

	const data = (await res.json()) as { id: string; url: string };
	return { id: data.id, url: data.url };
}

async function retrieveCheckoutSession(
	sessionId: string,
	secretKey: string
): Promise<StripeCheckoutSessionResponse | null> {
	if (!isCheckoutSessionId(sessionId)) return null;

	const res = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}`, {
		headers: { Authorization: `Bearer ${secretKey}` }
	});

	if (!res.ok) return null;
	return (await res.json()) as StripeCheckoutSessionResponse;
}

function checkoutSessionMatchesScan(
	session: StripeCheckoutSessionResponse,
	expectedScanUrl: string
): boolean {
	if (session.payment_status !== 'paid' || session.status !== 'complete') return false;

	const metaUrl = session.metadata?.scan_url?.trim();
	if (!metaUrl) return false;

	return canonicalScanUrl(metaUrl) === canonicalScanUrl(expectedScanUrl);
}

export async function verifyCheckoutSession(
	sessionId: string,
	expectedScanUrl: string,
	secretKey: string
): Promise<boolean> {
	try {
		const data = await retrieveCheckoutSession(sessionId, secretKey);
		return data ? checkoutSessionMatchesScan(data, expectedScanUrl) : false;
	} catch {
		return false;
	}
}

export async function createBillingPortalSession(opts: {
	sessionId: string;
	scanUrl: string;
	appUrl: string;
	secretKey: string;
}): Promise<BillingPortalSession> {
	const { sessionId, scanUrl, appUrl, secretKey } = opts;
	const checkout = await retrieveCheckoutSession(sessionId, secretKey);
	if (!checkout || !checkoutSessionMatchesScan(checkout, scanUrl)) {
		throw new Error('Checkout session could not be verified');
	}

	const customer = stripeObjectId(checkout.customer);
	if (!customer) throw new Error('No Stripe customer found for checkout session');

	const body = new URLSearchParams({
		customer,
		return_url: `${appUrl.replace(/\/$/, '')}/?billing=return&session_id=${sessionId}`
	});

	const res = await fetch(`${STRIPE_API}/billing_portal/sessions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secretKey}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Stripe billing portal failed: ${text.slice(0, 200)}`);
	}

	const data = (await res.json()) as { id: string; url: string };
	return { id: data.id, url: data.url };
}
