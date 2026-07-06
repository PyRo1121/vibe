import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url, platform }) => ({
	appUrl: platform?.env?.PUBLIC_APP_URL ?? url.origin
});
