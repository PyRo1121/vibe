import type { RequestHandler } from './$types';
import { handleScanPost } from '$lib/server/scan-handler';

export const POST: RequestHandler = async ({ request, platform }) =>
	handleScanPost(request, platform?.env);
