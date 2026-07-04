import { canonicalScanUrl } from '$lib/billing/stripe';

/** Paid unlocks persist per canonical scan URL — unlimited re-scans for that target. */
const UNLOCK_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface UnlockRecord {
	sessionId: string;
	paidAt: string;
}

export function unlockKey(scanUrl: string): string {
	return `unlock:${canonicalScanUrl(scanUrl)}`;
}

export async function loadUnlock(kv: KVNamespace, scanUrl: string): Promise<UnlockRecord | null> {
	try {
		return await kv.get<UnlockRecord>(unlockKey(scanUrl), 'json');
	} catch {
		return null;
	}
}

export async function saveUnlock(
	kv: KVNamespace,
	scanUrl: string,
	sessionId: string
): Promise<void> {
	try {
		const record: UnlockRecord = { sessionId, paidAt: new Date().toISOString() };
		await kv.put(unlockKey(scanUrl), JSON.stringify(record), {
			expirationTtl: UNLOCK_TTL_SECONDS
		});
	} catch {
		// Unlock cache is best-effort — Stripe verify remains the source of truth.
	}
}

export async function hasUnlock(
	kv: KVNamespace,
	scanUrl: string,
	sessionId: string
): Promise<boolean> {
	const record = await loadUnlock(kv, scanUrl);
	return record?.sessionId === sessionId;
}
