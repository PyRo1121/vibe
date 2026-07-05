import type { Handle } from '@sveltejs/kit';
import { isHttpError } from '@sveltejs/kit';
import { applySecurityHeaders, enforceEdgeSecurity } from '$lib/server/edge-security';

const REDIRECT_HOSTS = new Set(['deploylint.com', 'www.deploylint.com']);

/** 301 apex marketing domain → canonical host when DNS is pointed at this Worker. */
export const handle: Handle = async ({ event, resolve }) => {
	const host = event.request.headers.get('host')?.split(':')[0]?.toLowerCase();
	if (host && REDIRECT_HOSTS.has(host)) {
		const canonical =
			event.platform?.env?.PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://lint.latham.cloud';
		const target = new URL(event.url.pathname + event.url.search, canonical);
		return Response.redirect(target.href, 301);
	}

	try {
		const blocked = await enforceEdgeSecurity(event.platform?.env?.REPORTS, event.request);
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
