import { error, isHttpError } from '@sveltejs/kit';

/**
 * Cloudflare Workers Free tier guardrails. Limits reset at 00:00 UTC.
 * @see docs/superpowers/workflow/cloudflare-free-tier.md
 */
export const FREE_TIER_LIMITS = {
	/** ~3–4 KV writes per scan; 1k writes/day hard cap on Free. */
	scansPerDay: 175,
	/** Workers AI: 10k neurons/day free; copy review ≈ 300–500 neurons each. */
	aiCopyReviewsPerDay: 25,
	/** Abuse guard for first-party Plausible proxy (normal traffic is tiny). */
	plausibleEventsPerIpPerHour: 120
} as const;

const DAY_TTL_SECONDS = 60 * 60 * 48;

function utcDay(now = Date.now()): string {
	return new Date(now).toISOString().slice(0, 10);
}

function dayKey(prefix: string, now = Date.now()): string {
	return `${prefix}:${utcDay(now)}`;
}

function hourBucket(now = Date.now()): string {
	const d = new Date(now);
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, '0');
	const day = String(d.getUTCDate()).padStart(2, '0');
	const h = String(d.getUTCHours()).padStart(2, '0');
	return `${y}-${m}-${day}T${h}`;
}

/**
 * Global daily scan cap — keeps KV writes and Worker requests inside Free tier.
 * Fails open when KV is unavailable (local dev / transient errors).
 */
export async function assertDailyScanBudget(kv: KVNamespace | undefined): Promise<void> {
	if (!kv) return;

	const key = dayKey('budget:scans');
	try {
		const raw = await kv.get(key);
		const count = raw ? Number.parseInt(raw, 10) : 0;
		if (Number.isFinite(count) && count >= FREE_TIER_LIMITS.scansPerDay) {
			error(
				503,
				'Daily scan capacity reached — try again after midnight UTC. Deploylint stays on Cloudflare Free tier.'
			);
		}
		await kv.put(key, String((Number.isFinite(count) ? count : 0) + 1), {
			expirationTtl: DAY_TTL_SECONDS
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		/* budget enforcement is best-effort */
	}
}

/** Returns false when the daily Workers AI budget is exhausted. */
export async function reserveAiCopyReview(kv: KVNamespace | undefined): Promise<boolean> {
	if (!kv) return true;

	const key = dayKey('budget:ai');
	try {
		const raw = await kv.get(key);
		const count = raw ? Number.parseInt(raw, 10) : 0;
		if (Number.isFinite(count) && count >= FREE_TIER_LIMITS.aiCopyReviewsPerDay) {
			return false;
		}
		await kv.put(key, String((Number.isFinite(count) ? count : 0) + 1), {
			expirationTtl: DAY_TTL_SECONDS
		});
		return true;
	} catch {
		return true;
	}
}

/** Per-IP hourly cap for POST /s/event — blocks scripted event spam. */
export async function assertPlausibleEventBudget(
	kv: KVNamespace | undefined,
	ip: string
): Promise<void> {
	if (!kv || ip === 'unknown') return;

	const key = `budget:plausible:${ip}:${hourBucket()}`;
	try {
		const raw = await kv.get(key);
		const count = raw ? Number.parseInt(raw, 10) : 0;
		if (Number.isFinite(count) && count >= FREE_TIER_LIMITS.plausibleEventsPerIpPerHour) {
			error(429, 'Too many analytics events — slow down.');
		}
		await kv.put(key, String((Number.isFinite(count) ? count : 0) + 1), {
			expirationTtl: 7200
		});
	} catch (err) {
		if (isHttpError(err)) throw err;
		/* best-effort */
	}
}
