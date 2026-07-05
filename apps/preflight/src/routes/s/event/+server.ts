import { proxyPlausibleEvent } from '$lib/server/plausible-proxy';
import { clientIp } from '$lib/server/rate-limit';
import { assertPlausibleEventBudget } from '$lib/server/usage-budget';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
	await assertPlausibleEventBudget(
		platform?.env?.REPORTS,
		clientIp(request),
		platform?.env?.LIMITER
	);
	return proxyPlausibleEvent(request);
};
