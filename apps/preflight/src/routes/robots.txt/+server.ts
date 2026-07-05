import type { RequestHandler } from './$types';
import { DEFAULT_DEPLOYLINT_API } from '@vibe/deploylint-shared';

const BODY = `User-agent: *
Allow: /

Sitemap: ${DEFAULT_DEPLOYLINT_API}/sitemap.xml
`;

export const GET: RequestHandler = async () =>
	new Response(BODY, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
