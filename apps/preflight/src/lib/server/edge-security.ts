import { assertIpRateLimit, clientIp } from '$lib/server/rate-limit';
import { isHttpError } from '@sveltejs/kit';

/** Common exploit paths — block before the Worker does real work. */
const BLOCKED_PATH_SNIPPETS = [
	'/.env',
	'/.git',
	'/wp-admin',
	'/wp-login',
	'/wp-content',
	'/wordpress',
	'/xmlrpc.php',
	'/phpmyadmin',
	'/pma/',
	'/cgi-bin/',
	'/vendor/phpunit',
	'/actuator',
	'/telescope',
	'/.aws/',
	'/shell.php',
	'/eval-stdin.php',
	'/admin.php',
	'/boaform/',
	'/hudson',
	'/manager/html'
] as const;

const BLOCKED_METHODS = new Set(['TRACE', 'TRACK', 'CONNECT']);

/** Per-path API rate limits (requests per window). */
const API_RATE_LIMITS: Record<string, { limit: number; windowMs: number; message: string }> = {
	'/api/checkout': {
		limit: 12,
		windowMs: 60 * 60 * 1000,
		message: 'Too many checkout attempts — wait an hour and try again.'
	},
	'/api/events': {
		limit: 90,
		windowMs: 60 * 60 * 1000,
		message: 'Too many events — slow down.'
	},
	'/api/webhooks/stripe': {
		limit: 400,
		windowMs: 60 * 60 * 1000,
		message: 'Webhook rate limit exceeded.'
	}
};

const API_CATCHALL = {
	limit: 100,
	windowMs: 5 * 60 * 1000,
	message: 'Too many API requests — wait a few minutes.'
};

const MAX_POST_BYTES = 256 * 1024;

export function isBlockedProbePath(pathname: string): boolean {
	const path = pathname.toLowerCase();
	if (path.includes('..') || path.includes('%2e%2e')) return true;
	return BLOCKED_PATH_SNIPPETS.some((snippet) => path.includes(snippet));
}

export function isBlockedMethod(method: string): boolean {
	return BLOCKED_METHODS.has(method.toUpperCase());
}

export function postBodyTooLarge(request: Request): boolean {
	if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH') {
		return false;
	}
	const raw = request.headers.get('content-length');
	if (!raw) return false;
	const bytes = Number.parseInt(raw, 10);
	return Number.isFinite(bytes) && bytes > MAX_POST_BYTES;
}

export function applySecurityHeaders(response: Response, requestUrl?: string): Response {
	const headers = new Headers(response.headers);
	headers.set('X-Content-Type-Options', 'nosniff');
	headers.set('X-Frame-Options', 'DENY');
	headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
	headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	headers.set('Cross-Origin-Resource-Policy', 'same-site');
	const secure = (requestUrl ?? response.url).startsWith('https://');
	if (secure) {
		headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

/** Returns a 404 for probe paths, 405 for bad methods, 413 for huge bodies. */
export function probeBlockResponse(request: Request): Response | null {
	if (isBlockedMethod(request.method)) {
		return new Response('Method Not Allowed', { status: 405 });
	}
	const path = new URL(request.url).pathname;
	if (isBlockedProbePath(path)) {
		return new Response('Not Found', { status: 404 });
	}
	if (postBodyTooLarge(request)) {
		return new Response('Payload Too Large', { status: 413 });
	}
	return null;
}

/**
 * Rate-limit API routes at the edge. /api/scan keeps its tighter limit in scan-handler.
 */
export async function assertApiEdgeRateLimit(
	kv: KVNamespace | undefined,
	request: Request,
	limiter?: DurableObjectNamespace
): Promise<void> {
	const path = new URL(request.url).pathname;
	if (!path.startsWith('/api/')) return;

	const ip = clientIp(request);
	const specific = API_RATE_LIMITS[path];
	if (specific) {
		await assertIpRateLimit(
			{
				kv,
				ip,
				prefix: `api:${path}`,
				limit: specific.limit,
				windowMs: specific.windowMs,
				message: specific.message,
				limiter
			},
			{ failClosed: path === '/api/checkout' || path === '/api/webhooks/stripe' }
		);
		return;
	}

	if (path === '/api/scan') return;

	await assertIpRateLimit({
		kv,
		ip,
		prefix: 'api:catchall',
		limit: API_CATCHALL.limit,
		windowMs: API_CATCHALL.windowMs,
		message: API_CATCHALL.message,
		limiter
	});
}

/** Run all edge checks; throws SvelteKit HttpErrors for rate limits. */
export async function enforceEdgeSecurity(
	kv: KVNamespace | undefined,
	request: Request,
	limiter?: DurableObjectNamespace
): Promise<Response | null> {
	const blocked = probeBlockResponse(request);
	if (blocked) return blocked;

	try {
		await assertApiEdgeRateLimit(kv, request, limiter);
	} catch (err) {
		if (isHttpError(err)) throw err;
	}
	return null;
}
