import { getSeoLegacyRedirect } from '$lib/site/seo-redirects';
import { error, redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const csr = false;

export const load: PageServerLoad = ({ params, url, platform }) => {
	const target = getSeoLegacyRedirect(params.slug);
	if (!target) {
		error(404, 'Not found');
	}

	const base = platform?.env?.PUBLIC_APP_URL?.replace(/\/$/, '') ?? url.origin;
	redirect(301, `${base}${target}`);
};
