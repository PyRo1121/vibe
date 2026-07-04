import { error } from '@sveltejs/kit';

/** Scans allowed per IP per 5-minute window — generous for humans, blocks abuse. */
const SCAN_LIMIT_PER_WINDOW = 15;
const WINDOW_MS = 5 * 60 * 1000;
const KEY_TTL_SECONDS = 600;

export function clientIp(request: Request): string {
	return (
		request.headers.get('cf-connecting-ip')?.trim() ||
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		'unknown'
	);
}

function rateKey(ip: string, now = Date.now()): string {
	const bucket = Math.floor(now / WINDOW_MS);
	return `rate:scan:${ip}:${bucket}`;
}

/**
 * KV token-bucket rate limit for /api/scan. Skips when REPORTS KV is unbound (local dev).
 * Fails open on KV errors so scans never break because of rate-limit storage.
 */
export async function assertScanRateLimit(kv: KVNamespace | undefined, ip: string): Promise<void> {
	if (!kv || ip === 'unknown') return;

	const key = rateKey(ip);
	try {
		const raw = await kv.get(key);
		const count = raw ? Number.parseInt(raw, 10) : 0;
		if (Number.isFinite(count) && count >= SCAN_LIMIT_PER_WINDOW) {
			error(429, 'Too many scans — wait a few minutes and try again.');
		}
		await kv.put(key, String((Number.isFinite(count) ? count : 0) + 1), {
			expirationTtl: KEY_TTL_SECONDS
		});
	} catch {
		/* rate limiting is best-effort */
	}
}
