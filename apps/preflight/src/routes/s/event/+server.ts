import { proxyPlausibleEvent } from '$lib/server/plausible-proxy';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => proxyPlausibleEvent(request);
