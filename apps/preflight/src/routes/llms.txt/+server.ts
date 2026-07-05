import { buildLlmsTxt } from '$lib/site/crawler-surfaces';

import type { RequestHandler } from './$types';

const BODY = buildLlmsTxt();

export const GET: RequestHandler = async () =>
	new Response(BODY, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=300'
		}
	});
