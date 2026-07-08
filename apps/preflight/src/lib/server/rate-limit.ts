import { error, isHttpError } from '@sveltejs/kit';

/** Scans allowed per IP per 5-minute window - generous for humans, blocks abuse. */
const SCAN_LIMIT_PER_WINDOW = 15;
const WINDOW_MS = 5 * 60 * 1000;

export function clientIp(request: Request): string {
	return (
		request.headers.get('cf-connecting-ip')?.trim() ||
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		'unknown'
	);
}

function rateKey(prefix: string, ip: string, windowMs: number, now = Date.now()): string {
	const bucket = Math.floor(now / windowMs);
	return `${prefix}:${ip}:${bucket}`;
}

interface RateLimitRequest {
	kv: KVNamespace | undefined;
	ip: string;
	prefix: string;
	limit: number;
	windowMs: number;
	message: string;
	limiter?: DurableObjectNamespace;
}

interface RateLimitOptions {
	failClosed?: boolean;
	limiter?: DurableObjectNamespace;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isKvNamespace(value: unknown): value is KVNamespace {
	return isRecord(value) && typeof value.get === 'function' && typeof value.put === 'function';
}

function isDurableObjectNamespace(value: unknown): value is DurableObjectNamespace {
	return (
		isRecord(value) && typeof value.idFromName === 'function' && typeof value.get === 'function'
	);
}

function isPositiveNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRateLimitRequest(value: unknown): value is RateLimitRequest {
	if (!isRecord(value)) return false;

	return (
		(value.kv === undefined || isKvNamespace(value.kv)) &&
		(value.limiter === undefined || isDurableObjectNamespace(value.limiter)) &&
		typeof value.ip === 'string' &&
		value.ip.length > 0 &&
		typeof value.prefix === 'string' &&
		value.prefix.length > 0 &&
		isPositiveNumber(value.limit) &&
		isPositiveNumber(value.windowMs) &&
		typeof value.message === 'string' &&
		value.message.length > 0
	);
}

function buildRateLimitRequest(
	reqOrKv: RateLimitRequest | KVNamespace | undefined,
	ipOrOpts?: string | RateLimitOptions,
	prefix?: string,
	limit?: number,
	windowMs?: number,
	message?: string
): RateLimitRequest {
	if (typeof ipOrOpts === 'string') {
		if (!prefix || !isPositiveNumber(limit) || !isPositiveNumber(windowMs) || !message) {
			throw new TypeError('Invalid rate limit request.');
		}

		return {
			kv: isKvNamespace(reqOrKv) ? reqOrKv : undefined,
			ip: ipOrOpts,
			prefix,
			limit,
			windowMs,
			message
		};
	}

	if (isRateLimitRequest(reqOrKv)) return reqOrKv;
	throw new TypeError('Invalid rate limit request.');
}

async function reserveDurableLimit(
	limiter: DurableObjectNamespace | undefined,
	req: RateLimitRequest
): Promise<boolean> {
	if (!limiter || req.ip === 'unknown') return false;

	const id = limiter.idFromName(req.prefix);
	const stub = limiter.get(id);
	const res = await stub.fetch(
		new Request('https://limiter.local/reserve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				key: rateKey('ip', req.ip, req.windowMs),
				limit: req.limit,
				windowMs: req.windowMs
			})
		})
	);
	if (!res.ok) throw new Error(`Limiter failed (${res.status})`);
	const body = await res.json();
	if (!isRecord(body) || body.allowed !== true) error(429, req.message);
	return true;
}

/**
 * Generic limiter. Durable Object is authoritative when bound; KV remains the
 * local/dev fallback and is best-effort because KV has no atomic increment.
 */
export async function assertIpRateLimit(
	req: RateLimitRequest,
	opts?: RateLimitOptions
): Promise<void>;
export async function assertIpRateLimit(
	kv: KVNamespace | undefined,
	ip: string,
	prefix: string,
	limit: number,
	windowMs: number,
	message: string,
	opts?: RateLimitOptions
): Promise<void>;
export async function assertIpRateLimit(
	reqOrKv: RateLimitRequest | KVNamespace | undefined,
	ipOrOpts?: string | RateLimitOptions,
	prefix?: string,
	limit?: number,
	windowMs?: number,
	message?: string,
	opts?: RateLimitOptions
): Promise<void> {
	const req = buildRateLimitRequest(reqOrKv, ipOrOpts, prefix, limit, windowMs, message);
	const options = typeof ipOrOpts === 'string' ? opts : ipOrOpts;

	try {
		if (await reserveDurableLimit(options?.limiter ?? req.limiter, req)) return;
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (options?.failClosed) {
			error(503, 'Service temporarily unavailable - try again shortly.');
		}
	}

	if (!req.kv || req.ip === 'unknown') return;

	const key = rateKey(req.prefix, req.ip, req.windowMs);
	const ttlSeconds = Math.max(120, Math.ceil(req.windowMs / 1000) + 60);
	try {
		const raw = await req.kv.get(key);
		const count = raw ? Number.parseInt(raw, 10) : 0;
		if (Number.isFinite(count) && count >= req.limit) {
			error(429, req.message);
		}
		await req.kv.put(key, String((Number.isFinite(count) ? count : 0) + 1), {
			expirationTtl: ttlSeconds
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (options?.failClosed) {
			error(503, 'Service temporarily unavailable - try again shortly.');
		}
		/* rate limiting is best-effort */
	}
}

/**
 * Rate limit for /api/scan. Skips when no limiter/KV is bound in local dev.
 * Fails open on storage errors so scans never break because of limit storage.
 */
export async function assertScanRateLimit(
	kv: KVNamespace | undefined,
	ip: string,
	limiter?: DurableObjectNamespace
): Promise<void> {
	await assertIpRateLimit(
		{
			kv,
			ip,
			prefix: 'rate:scan',
			limit: SCAN_LIMIT_PER_WINDOW,
			windowMs: WINDOW_MS,
			message: 'Too many advisory previews - wait a few minutes and try again.'
		},
		{ failClosed: false, limiter }
	);
}
