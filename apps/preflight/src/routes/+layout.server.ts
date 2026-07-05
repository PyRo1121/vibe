import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ platform }) => {
	const plausibleDomain = platform?.env?.PUBLIC_PLAUSIBLE_DOMAIN?.trim() || null;

	return {
		plausibleDomain,
		plausibleProxy: plausibleDomain
			? { script: `/s/script.js?site=${encodeURIComponent(plausibleDomain)}`, endpoint: '/s/event' }
			: null
	};
};
