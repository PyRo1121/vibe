import type { RequestHandler } from './$types';

const BODY = `User-agent: *
Allow: /

Sitemap: https://lint.latham.cloud/sitemap.xml
`;

export const GET: RequestHandler = async () =>
	new Response(BODY, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
