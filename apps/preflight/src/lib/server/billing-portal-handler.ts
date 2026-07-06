import { createBillingPortalSession } from '$lib/billing/stripe';
import { UrlValidationError } from '$lib/scan/url-guard';
import { parseScanRequestBody } from '$lib/scan/validate';
import { readJsonBody, rejectValidation } from '$lib/server/api';
import { requireStripeSecretKey, resolveAppUrl } from '$lib/server/env';
import { json, error } from '@sveltejs/kit';

export async function handleBillingPortalPost(
	request: Request,
	env: Env | undefined,
	requestOrigin: string
) {
	let scanUrl: string;
	let sessionId: string;
	try {
		const body = await readJsonBody(request);
		const parsed = parseScanRequestBody(body);
		if (!parsed.unlockSessionId) throw new UrlValidationError('Missing unlockSessionId');
		scanUrl = parsed.url;
		sessionId = parsed.unlockSessionId;
	} catch (err) {
		rejectValidation(err);
	}

	const secretKey = requireStripeSecretKey(env);
	const appUrl = resolveAppUrl(env, requestOrigin);

	try {
		const portal = await createBillingPortalSession({
			sessionId,
			scanUrl,
			appUrl,
			secretKey
		});
		return json(portal);
	} catch {
		error(502, 'Billing portal failed - try again in a moment');
	}
}
