import { canonicalScanUrl } from '$lib/billing/stripe';
import { stableStorageKey } from '$lib/server/storage-key';

/** Paid unlocks persist per canonical scan URL - unlimited re-scans for that target. */
const UNLOCK_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface UnlockRecord {
	sessionId: string;
	paidAt: string;
	scanUrl?: string;
}

export function unlockKey(scanUrl: string): string {
	return stableStorageKey('unlock', canonicalScanUrl(scanUrl));
}

export function legacyUnlockKey(scanUrl: string): string {
	return `unlock:${canonicalScanUrl(scanUrl)}`;
}

export async function loadUnlock(kv: KVNamespace, scanUrl: string): Promise<UnlockRecord | null> {
	try {
		const record = await kv.get<UnlockRecord>(unlockKey(scanUrl), 'json');
		if (record) return record;
		return await kv.get<UnlockRecord>(legacyUnlockKey(scanUrl), 'json');
	} catch {
		return null;
	}
}

export async function saveUnlock(
	kv: KVNamespace,
	scanUrl: string,
	sessionId: string
): Promise<void> {
	const record: UnlockRecord = {
		sessionId,
		paidAt: new Date().toISOString(),
		scanUrl: canonicalScanUrl(scanUrl)
	};
	await kv.put(unlockKey(scanUrl), JSON.stringify(record), {
		expirationTtl: UNLOCK_TTL_SECONDS
	});
}

export async function hasUnlock(
	kv: KVNamespace,
	scanUrl: string,
	sessionId: string
): Promise<boolean> {
	const record = await loadUnlock(kv, scanUrl);
	return record?.sessionId === sessionId;
}
