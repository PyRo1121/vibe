import { json, error } from '@sveltejs/kit';
import { createCheckoutSession } from '$lib/billing/stripe';
import { readJsonBody, rejectValidation } from '$lib/server/api';
import { requireStripePriceId, requireStripeSecretKey, resolveAppUrl } from '$lib/server/env';
import { logFunnelEvent } from '$lib/metrics/funnel';
import { resolveDeploylintPlan } from '$lib/product/plans';
import { parseScanRequestBody } from '$lib/scan/validate';

export async function handleCheckoutPost(
	request: Request,
	env: Env | undefined,
	requestOrigin: string
) {
	let scanUrlValue: string;
	let plan = resolveDeploylintPlan(undefined);
	try {
		const body = await readJsonBody(request);
		scanUrlValue = parseScanRequestBody(body).url;
		plan = resolveDeploylintPlan(
			body && typeof body === 'object' ? (body as { plan?: unknown }).plan : undefined
		);
	} catch (err) {
		rejectValidation(err);
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
		logFunnelEvent('checkout_started', {});
		return json({ url: session.url, sessionId: session.id });
	} catch {
		error(502, 'Checkout failed — try again in a moment');
	}
}
