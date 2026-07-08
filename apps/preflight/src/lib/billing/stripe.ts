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
	customer?: string | { id: string };
}

interface StripeSessionRedirectResponse {
	id: string;
	url: string;
}

function isCheckoutSessionId(sessionId: string): boolean {
	return /^cs_(test|live)_[a-zA-Z0-9]+$/.test(sessionId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function nonEmptyString(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function stripeObjectId(value: unknown): string | null {
	if (typeof value === 'string' && value.trim()) return value.trim();
	if (isRecord(value) && typeof value.id === 'string' && value.id.trim()) {
		return value.id.trim();
	}
	return null;
}

function stripeMetadata(value: unknown): StripeCheckoutSessionResponse['metadata'] | undefined {
	if (!isRecord(value)) return undefined;

	const scanUrl = nonEmptyString(value.scan_url);
	return scanUrl ? { scan_url: scanUrl } : undefined;
}

function stripeCustomer(value: unknown): StripeCheckoutSessionResponse['customer'] | undefined {
	const id = stripeObjectId(value);
	if (!id) return undefined;
	return typeof value === 'string' ? id : { id };
}

function parseCheckoutSessionResponse(value: unknown): StripeCheckoutSessionResponse | null {
	if (!isRecord(value)) return null;

	return {
		id: nonEmptyString(value.id) ?? undefined,
		payment_status: nonEmptyString(value.payment_status) ?? undefined,
		status: nonEmptyString(value.status) ?? undefined,
		metadata: stripeMetadata(value.metadata),
		customer: stripeCustomer(value.customer)
	};
}

function parseSessionRedirectResponse(
	value: unknown,
	errorMessage: string
): StripeSessionRedirectResponse {
	if (!isRecord(value)) throw new Error(errorMessage);

	const id = nonEmptyString(value.id);
	const url = nonEmptyString(value.url);
	if (!id || !url) throw new Error(errorMessage);

	return { id, url };
}

function checkoutIdempotencyKey(scanUrl: string): string {
	const urlHash = createHash('sha256').update(canonicalScanUrl(scanUrl)).digest('hex').slice(0, 16);
	return `checkout-${urlHash}-${randomUUID()}`;
}

function workspaceCheckoutIdempotencyKey(workspaceId: string): string {
	const workspaceHash = createHash('sha256').update(workspaceId).digest('hex').slice(0, 16);
	return `workspace-checkout-${workspaceHash}-${randomUUID()}`;
}

export async function createCheckoutSession(opts: {
	scanUrl: string;
	appUrl: string;
	secretKey: string;
	plan: DeploylintPlanId;
	priceId: string;
}): Promise<CheckoutSession> {
	const { scanUrl, appUrl, secretKey, plan, priceId } = opts;
	const returnBase = `${appUrl.replace(/\/$/, '')}/review`;
	const successUrl = `${returnBase}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
	const cancelUrl = `${returnBase}?checkout=cancel`;
	const canonicalUrl = canonicalScanUrl(scanUrl).slice(0, 500);

	const body = new URLSearchParams({
		mode: 'subscription',
		success_url: successUrl,
		cancel_url: cancelUrl,
		allow_promotion_codes: 'true',
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

	const data = parseSessionRedirectResponse(
		await res.json(),
		'Malformed Stripe checkout session response'
	);
	return { id: data.id, url: data.url };
}

export async function createWorkspaceCheckoutSession(opts: {
	appUrl: string;
	customerEmail: string;
	deployUrl: string;
	plan: DeploylintPlanId;
	priceId: string;
	projectId: string;
	secretKey: string;
	workspaceId: string;
}): Promise<CheckoutSession> {
	const { appUrl, customerEmail, deployUrl, plan, priceId, projectId, secretKey, workspaceId } =
		opts;
	const returnBase = `${appUrl.replace(/\/$/, '')}/app`;
	const successUrl = `${returnBase}?checkout=success`;
	const cancelUrl = `${returnBase}?checkout=cancel`;
	const canonicalDeployUrl = canonicalScanUrl(deployUrl).slice(0, 500);

	const body = new URLSearchParams({
		mode: 'subscription',
		success_url: successUrl,
		cancel_url: cancelUrl,
		client_reference_id: workspaceId,
		customer_email: customerEmail,
		allow_promotion_codes: 'true',
		'payment_method_types[0]': 'card',
		'line_items[0][quantity]': '1',
		'line_items[0][price]': priceId,
		'metadata[plan]': plan,
		'metadata[workspace_id]': workspaceId,
		'metadata[project_id]': projectId,
		'metadata[deploy_url]': canonicalDeployUrl,
		'subscription_data[metadata][plan]': plan,
		'subscription_data[metadata][workspace_id]': workspaceId,
		'subscription_data[metadata][project_id]': projectId,
		'subscription_data[metadata][deploy_url]': canonicalDeployUrl
	});

	const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${secretKey}`,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Idempotency-Key': workspaceCheckoutIdempotencyKey(workspaceId)
		},
		body
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Stripe workspace checkout failed: ${text.slice(0, 200)}`);
	}

	const data = parseSessionRedirectResponse(
		await res.json(),
		'Malformed Stripe workspace checkout session response'
	);
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
	return parseCheckoutSessionResponse(await res.json());
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
		return_url: `${appUrl.replace(/\/$/, '')}/review?billing=return&session_id=${sessionId}`
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

	const data = parseSessionRedirectResponse(
		await res.json(),
		'Malformed Stripe billing portal session response'
	);
	return { id: data.id, url: data.url };
}
