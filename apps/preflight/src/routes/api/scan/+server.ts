import { handleScanPost } from '$lib/server/scan-handler';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) =>
	handleScanPost(request, platform?.env);
