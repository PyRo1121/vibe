import { applySecurityHeaders, enforceEdgeSecurity } from '$lib/server/edge-security';
import type { Handle } from '@sveltejs/kit';
import { isHttpError } from '@sveltejs/kit';
import {
	DEFAULT_DEPLOYLINT_API,
	DEPLOYLINT_LEGACY_HOST,
	DEPLOYLINT_WWW_HOST
} from '@vibe/deploylint-shared';

export { CounterLimiter } from '$lib/server/counter-limiter';

const REDIRECT_HOSTS = new Set([DEPLOYLINT_LEGACY_HOST, DEPLOYLINT_WWW_HOST]);
const PUBLIC_HOSTS = new Set([
	new URL(DEFAULT_DEPLOYLINT_API).hostname,
	DEPLOYLINT_LEGACY_HOST,
	DEPLOYLINT_WWW_HOST
]);
const LEGACY_DIRECT_PREFIXES = ['/api/', '/s/'];

/** 301 legacy and www hosts to the canonical apex domain. */
export const handle: Handle = async ({ event, resolve }) => {
	const host = event.request.headers.get('host')?.split(':')[0]?.toLowerCase();
	const shouldServeDirect = LEGACY_DIRECT_PREFIXES.some((prefix) =>
		event.url.pathname.startsWith(prefix)
	);
	const canonical =
		event.platform?.env?.PUBLIC_APP_URL?.replace(/\/$/, '') ?? DEFAULT_DEPLOYLINT_API;

	if (host && PUBLIC_HOSTS.has(host) && event.url.protocol === 'http:' && !shouldServeDirect) {
		const target = new URL(event.url.pathname + event.url.search, canonical);
		return Response.redirect(target.href, 301);
	}

	if (host && REDIRECT_HOSTS.has(host) && !shouldServeDirect) {
		const target = new URL(event.url.pathname + event.url.search, canonical);
		return Response.redirect(target.href, 301);
	}

	try {
		const blocked = await enforceEdgeSecurity(
			event.platform?.env?.REPORTS,
			event.request,
			event.platform?.env?.LIMITER
		);
		if (blocked) return applySecurityHeaders(blocked, event.url.href);
	} catch (err) {
		if (isHttpError(err)) {
			const message =
				typeof err.body === 'object' && err.body && 'message' in err.body
					? String((err.body as { message: string }).message)
					: 'Too Many Requests';
			return applySecurityHeaders(
				new Response(message, {
					status: err.status,
					headers: { 'Content-Type': 'text/plain; charset=utf-8' }
				}),
				event.url.href
			);
		}
		throw err;
	}

	const response = await resolve(event);
	return applySecurityHeaders(response, event.url.href);
};
