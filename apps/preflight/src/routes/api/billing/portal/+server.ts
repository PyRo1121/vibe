import { handleBillingPortalPost } from '$lib/server/billing-portal-handler';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, url }) =>
	handleBillingPortalPost(request, platform?.env, url.origin);
