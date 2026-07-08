import { handleScanPost } from '$lib/server/scan-handler';
import { isHttpError, json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

function nextUtcMidnight(now = new Date()): string {
	return new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
	).toISOString();
}

export const POST: RequestHandler = async ({ request, platform }) => {
	try {
		return await handleScanPost(request, platform?.env);
	} catch (err) {
		if (!isHttpError(err)) throw err;

		const message = err.body.message;
		const capacityReached = err.status === 503 && /daily scan capacity reached/i.test(message);

		return json(
			{
				message,
				status: err.status,
				...(capacityReached
					? { code: 'daily_scan_capacity_reached', retryAt: nextUtcMidnight() }
					: {})
			},
			{ status: err.status }
		);
	}
};
