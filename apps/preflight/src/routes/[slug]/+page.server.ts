import { error } from '@sveltejs/kit';
import { getSeoLandingPage } from '$lib/site/seo-pages';
import type { PageServerLoad } from './$types';

export const csr = false;

export const load: PageServerLoad = ({ params, url, platform }) => {
	const page = getSeoLandingPage(params.slug);
	if (!page) {
		error(404, 'Not found');
	}

	return {
		appUrl: platform?.env?.PUBLIC_APP_URL ?? url.origin,
		page
	};
};
