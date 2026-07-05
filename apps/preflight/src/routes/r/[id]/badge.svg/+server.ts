import { buildBadgeSvg } from '$lib/server/badge';
import { loadReport } from '$lib/server/report-store';
import { error } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const kv = platform?.env?.REPORTS;
	if (!kv) error(404, 'Report storage is not configured');

	const report = await loadReport(kv, params.id);
	if (!report) error(404, 'Report not found or expired');

	return new Response(buildBadgeSvg(report.score), {
		headers: {
			'Content-Type': 'image/svg+xml',
			// GitHub's camo proxy respects cache headers; an hour keeps badges fresh-ish.
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
