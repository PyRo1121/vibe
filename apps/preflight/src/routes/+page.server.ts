import { resolveAlphaFreeUnlock } from '$lib/product/alpha';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, platform }) => ({
	alphaFreeUnlock: resolveAlphaFreeUnlock(platform?.env),
	checkout: url.searchParams.get('checkout'),
	billing: url.searchParams.get('billing'),
	sessionId: url.searchParams.get('session_id'),
	appUrl: platform?.env?.PUBLIC_APP_URL ?? url.origin
});
