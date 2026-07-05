import { getGuide } from '$lib/site/guides';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const csr = false;

export const load: PageServerLoad = ({ params, url, platform }) => {
	const guide = getGuide(params.slug);
	if (!guide) error(404, 'Guide not found');

	return {
		appUrl: platform?.env?.PUBLIC_APP_URL ?? url.origin,
		guide
	};
};
