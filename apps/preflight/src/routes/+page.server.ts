import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, platform }) => ({
	checkout: url.searchParams.get('checkout'),
	sessionId: url.searchParams.get('session_id'),
	appUrl: platform?.env?.PUBLIC_APP_URL ?? url.origin
});
