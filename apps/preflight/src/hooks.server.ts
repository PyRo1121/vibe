import type { Handle } from '@sveltejs/kit';

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

	return resolve(event);
};
