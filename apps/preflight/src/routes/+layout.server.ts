import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ platform }) => ({
	plausibleDomain: platform?.env?.PUBLIC_PLAUSIBLE_DOMAIN?.trim() || null
});
