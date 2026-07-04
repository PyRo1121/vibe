import type { RequestHandler } from './$types';
import { handleCheckoutPost } from '$lib/server/checkout-handler';

export const POST: RequestHandler = async ({ request, platform, url }) =>
	handleCheckoutPost(request, platform?.env, url.origin);
