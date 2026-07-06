import { resolveAlphaFreeUnlock } from '$lib/product/alpha';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ platform }) => {
	const plausibleDomain = platform?.env?.PUBLIC_PLAUSIBLE_DOMAIN?.trim() || null;
	const plausibleScript = platform?.env?.PUBLIC_PLAUSIBLE_SCRIPT?.trim() || null;

	return {
		alphaFreeUnlock: resolveAlphaFreeUnlock(platform?.env),
		plausibleDomain,
		plausibleScript: plausibleDomain ? plausibleScript : null
	};
};
