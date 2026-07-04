import { error } from '@sveltejs/kit';
import { loadReport } from '$lib/server/report-store';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, url }) => {
	const kv = platform?.env?.REPORTS;
	if (!kv) error(404, 'Report storage is not configured');

	const report = await loadReport(kv, params.id);
	if (!report) error(404, 'Report not found or expired — reports are kept for 90 days');

	return {
		report,
		appUrl: platform?.env?.PUBLIC_APP_URL ?? url.origin
	};
};
