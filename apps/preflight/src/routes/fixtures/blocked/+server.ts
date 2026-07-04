import type { RequestHandler } from './$types';

/** Smoke fixture — simulates bot/WAF block (HTTP 403) for incomplete-scan tests. */
export const GET: RequestHandler = async () =>
	new Response(
		`<!DOCTYPE html><html><head><title>Access denied</title></head><body><p>403 Forbidden</p></body></html>`,
		{
			status: 403,
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'no-store'
			}
		}
	);
