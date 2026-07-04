import type { RequestHandler } from './$types';
import { handleEventsPost } from '$lib/server/events-handler';
import { rejectValidation } from '$lib/server/api';

export const POST: RequestHandler = async ({ request }) => {
	try {
		return await handleEventsPost(request);
	} catch (err) {
		rejectValidation(err);
	}
};
