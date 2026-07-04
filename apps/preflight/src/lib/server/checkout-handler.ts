import { json, error } from '@sveltejs/kit';
import { createCheckoutSession } from '$lib/billing/stripe';
import { parseScanJsonBody, rejectValidation } from '$lib/server/api';
import { requireStripeSecretKey, resolveAppUrl } from '$lib/server/env';
import { logFunnelEvent } from '$lib/metrics/funnel';

export async function handleCheckoutPost(
	request: Request,
	env: Env | undefined,
	requestOrigin: string
) {
	let scanUrlValue: string;
	try {
		scanUrlValue = (await parseScanJsonBody(request)).url;
	} catch (err) {
		rejectValidation(err);
	}

	const secretKey = requireStripeSecretKey(env);
	const appUrl = resolveAppUrl(env, requestOrigin);

	try {
		const session = await createCheckoutSession({
			scanUrl: scanUrlValue,
			appUrl,
			secretKey
		});
		logFunnelEvent('checkout_started', {});
		return json({ url: session.url, sessionId: session.id });
	} catch {
		error(502, 'Checkout failed — try again in a moment');
	}
}
