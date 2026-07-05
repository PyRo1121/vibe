import { error, isHttpError } from '@sveltejs/kit';

/** Scans allowed per IP per 5-minute window — generous for humans, blocks abuse. */
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

/**
 * Generic KV token-bucket limiter. Skips when KV is unbound (local dev).
 * Billing paths fail closed on KV errors; scan limits fail open to preserve availability.
 */
export async function assertIpRateLimit(
	kv: KVNamespace | undefined,
	ip: string,
	prefix: string,
	limit: number,
	windowMs: number,
	message: string,
	opts?: { failClosed?: boolean }
): Promise<void> {
	if (!kv || ip === 'unknown') return;

	const key = rateKey(prefix, ip, windowMs);
	const ttlSeconds = Math.max(120, Math.ceil(windowMs / 1000) + 60);
	try {
		const raw = await kv.get(key);
		const count = raw ? Number.parseInt(raw, 10) : 0;
		if (Number.isFinite(count) && count >= limit) {
			error(429, message);
		}
		await kv.put(key, String((Number.isFinite(count) ? count : 0) + 1), {
			expirationTtl: ttlSeconds
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (opts?.failClosed) {
			error(503, 'Service temporarily unavailable — try again shortly.');
		}
		/* rate limiting is best-effort */
	}
}

/**
 * KV token-bucket rate limit for /api/scan. Skips when REPORTS KV is unbound (local dev).
 * Fails open on KV errors so scans never break because of rate-limit storage.
 */
export async function assertScanRateLimit(kv: KVNamespace | undefined, ip: string): Promise<void> {
	await assertIpRateLimit(
		kv,
		ip,
		'rate:scan',
		SCAN_LIMIT_PER_WINDOW,
		WINDOW_MS,
		'Too many scans — wait a few minutes and try again.',
		{ failClosed: false }
	);
}
