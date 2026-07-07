import { resolveAuthFeatureFlags, sanitizeRedirectTo } from '$lib/server/auth-config';
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, platform, url }) => {
	const redirectTo = sanitizeRedirectTo(url.searchParams.get('redirectTo'));

	if (locals.user) {
		redirect(303, redirectTo);
	}

	return {
		redirectTo,
		auth: resolveAuthFeatureFlags(platform?.env)
	};
};
