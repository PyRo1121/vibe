import { rejectValidation } from '$lib/server/api';
import { handleEventsPost } from '$lib/server/events-handler';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		return await handleEventsPost(request);
	} catch (err) {
		return rejectValidation(err);
	}
};
