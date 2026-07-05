const PLAUSIBLE_EVENT_URL = 'https://plausible.io/api/event';
const DEFAULT_UPSTREAM_SCRIPT = 'https://plausible.io/js/script.js';
const SCRIPT_CACHE_SECONDS = 60 * 60 * 24 * 30;

export function plausibleUpstreamScript(env?: { PUBLIC_PLAUSIBLE_SCRIPT?: string }): string {
	return env?.PUBLIC_PLAUSIBLE_SCRIPT?.trim() || DEFAULT_UPSTREAM_SCRIPT;
}

export async function proxyPlausibleScript(upstream: string): Promise<Response> {
	const res = await fetch(upstream, {
		headers: { Accept: 'application/javascript,*/*' }
	});

	return new Response(res.body, {
		status: res.status,
		headers: {
			'Content-Type': 'application/javascript; charset=utf-8',
			'Cache-Control': `public, max-age=${SCRIPT_CACHE_SECONDS}, s-maxage=${SCRIPT_CACHE_SECONDS}, stale-while-revalidate=86400`,
			'Access-Control-Allow-Origin': '*'
		}
	});
}

export async function proxyPlausibleEvent(request: Request): Promise<Response> {
	const headers = new Headers();
	const contentType = request.headers.get('Content-Type');
	if (contentType) headers.set('Content-Type', contentType);

	const userAgent = request.headers.get('User-Agent');
	if (userAgent) headers.set('User-Agent', userAgent);

	const clientIp =
		request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For');
	if (clientIp) headers.set('X-Forwarded-For', clientIp);

	const res = await fetch(PLAUSIBLE_EVENT_URL, {
		method: 'POST',
		headers,
		body: await request.text()
	});

	const out = new Headers();
	const dropped = res.headers.get('x-plausible-dropped');
	if (dropped) out.set('x-plausible-dropped', dropped);

	return new Response(null, { status: res.status, headers: out });
}
