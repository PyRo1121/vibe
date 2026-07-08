import { createCheckoutSession, isStripeLiveMode } from '$lib/billing/stripe';
import { logFunnelEvent } from '$lib/metrics/funnel';
import { resolveDeploylintPlan } from '$lib/product/plans';
import { parseScanRequestBody } from '$lib/scan/validate';
import { readJsonBody, rejectValidation } from '$lib/server/api';
import { requireStripePriceId, requireStripeSecretKey, resolveAppUrl } from '$lib/server/env';
import { json, error } from '@sveltejs/kit';

function checkoutErrorMessage(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	return message.slice(0, 300);
}

export async function handleCheckoutPost(
	request: Request,
	env: Env | undefined,
	requestOrigin: string
) {
	let scanUrlValue: string;
	let plan = resolveDeploylintPlan();
	try {
		const body = await readJsonBody(request);
		scanUrlValue = parseScanRequestBody(body).url;
		plan = resolveDeploylintPlan(
			body && typeof body === 'object' ? (body as { plan?: unknown }).plan : undefined
		);
	} catch (err) {
		return rejectValidation(err);
	}

	const secretKey = requireStripeSecretKey(env);
	const appUrl = resolveAppUrl(env, requestOrigin);
	const priceId = requireStripePriceId(env, plan.id);

	try {
		const session = await createCheckoutSession({
			scanUrl: scanUrlValue,
			appUrl,
			secretKey,
			plan: plan.id,
			priceId
		});
		logFunnelEvent('checkout_started', { plan: plan.id, mode: 'paid' });
		return json({ url: session.url, sessionId: session.id });
	} catch (err) {
		console.error('deploylint.checkout.failed', {
			plan: plan.id,
			priceEnv: plan.stripePriceEnv,
			stripeMode: isStripeLiveMode(secretKey) ? 'live' : 'test',
			message: checkoutErrorMessage(err)
		});
		return error(502, 'Checkout failed - try again in a moment');
	}
}
