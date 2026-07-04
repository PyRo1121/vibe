import { createHash } from 'node:crypto';
import { assertPublicHttpUrl } from '$lib/scan/url-guard';

const STRIPE_API = 'https://api.stripe.com/v1';

/** Normalize scan URLs for Stripe metadata and unlock verification. */
export function canonicalScanUrl(raw: string): string {
	return assertPublicHttpUrl(raw).href.replace(/\/$/, '');
}

export interface CheckoutSession {
	id: string;
	url: string;
}

function checkoutIdempotencyKey(scanUrl: string): string {
	return createHash('sha256').update(canonicalScanUrl(scanUrl)).digest('hex').slice(0, 32);
}

export async function createCheckoutSession(opts: {
	scanUrl: string;
	appUrl: string;
	secretKey: string;
}): Promise<CheckoutSession> {
	const { scanUrl, appUrl, secretKey } = opts;
	const successUrl = `${appUrl.replace(/\/$/, '')}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
	const cancelUrl = `${appUrl.replace(/\/$/, '')}/?checkout=cancel`;

	const body = new URLSearchParams({
		mode: 'payment',
		success_url: successUrl,
		cancel_url: cancelUrl,
		// Instant methods only — avoids async checkout.session.async_payment_* flow for $9 unlock
		'payment_method_types[0]': 'card',
		'line_items[0][quantity]': '1',
		'line_items[0][price_data][currency]': 'usd',
		'line_items[0][price_data][unit_amount]': '900',
		'line_items[0][price_data][product_data][name]': 'Preflight fix & verify',
		'line_items[0][price_data][product_data][description]':
			'All AI fix prompts, master repair prompt, and unlimited re-scans for this URL',
		'metadata[scan_url]': canonicalScanUrl(scanUrl).slice(0, 500)
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

export async function verifyCheckoutSession(
	sessionId: string,
	expectedScanUrl: string,
	secretKey: string
): Promise<boolean> {
	if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId)) {
		return false;
	}

	try {
		const res = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}`, {
			headers: { Authorization: `Bearer ${secretKey}` }
		});

		if (!res.ok) return false;

		const data = (await res.json()) as {
			payment_status?: string;
			status?: string;
			metadata?: { scan_url?: string };
		};

		if (data.payment_status !== 'paid' || data.status !== 'complete') return false;

		const metaUrl = data.metadata?.scan_url?.trim();
		if (!metaUrl) return false;

		return canonicalScanUrl(metaUrl) === canonicalScanUrl(expectedScanUrl);
	} catch {
		return false;
	}
}
