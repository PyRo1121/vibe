import { buildSitemapXml } from '$lib/site/crawler-surfaces';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () =>
	new Response(buildSitemapXml(), {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
