import { error } from '@sveltejs/kit';

export function requireStripeSecretKey(env: Env | undefined): string {
	const key = env?.STRIPE_SECRET_KEY;
	if (!key) error(503, 'Stripe is not configured yet');
	return key;
}

export function requireStripeWebhookSecretKey(env: Env | undefined): string {
	const secret = env?.STRIPE_WEBHOOK_SECRET;
	if (!secret) error(503, 'Webhook not configured');
	return secret;
}

/** Prefer wrangler `PUBLIC_APP_URL`; fall back to request origin only in dev. */
export function resolveAppUrl(env: Env | undefined, requestOrigin: string): string {
	const configured = env?.PUBLIC_APP_URL?.trim();
	if (configured) return configured.replace(/\/$/, '');
	return requestOrigin.replace(/\/$/, '');
}
