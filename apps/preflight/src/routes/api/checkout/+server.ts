import { handleCheckoutPost } from '$lib/server/checkout-handler';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform, url }) =>
	handleCheckoutPost(request, platform?.env, url.origin);
