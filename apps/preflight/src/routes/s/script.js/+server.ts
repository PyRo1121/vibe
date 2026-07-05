import { plausibleUpstreamScript, proxyPlausibleScript } from '$lib/server/plausible-proxy';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ platform }) => {
	const upstream = plausibleUpstreamScript(platform?.env);
	return proxyPlausibleScript(upstream);
};
