import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ platform }) => {
	const plausibleDomain = platform?.env?.PUBLIC_PLAUSIBLE_DOMAIN?.trim() || null;
	const plausibleScript = platform?.env?.PUBLIC_PLAUSIBLE_SCRIPT?.trim() || null;

	return {
		plausibleDomain,
		plausibleScript: plausibleDomain ? plausibleScript : null
	};
};
