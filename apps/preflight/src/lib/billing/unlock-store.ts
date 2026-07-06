import { canonicalScanUrl } from '$lib/billing/stripe';
import { stableStorageKey } from '$lib/server/storage-key';

/** Paid unlocks persist per canonical scan URL - unlimited re-scans for that target. */
const UNLOCK_TTL_SECONDS = 60 * 60 * 24 * 365;

export type UnlockStatus = 'active' | 'past_due' | 'canceled';

export interface UnlockRecord {
	sessionId: string;
	paidAt: string;
	scanUrl?: string;
	customerId?: string;
	subscriptionId?: string;
	plan?: string;
	active?: boolean;
	status?: UnlockStatus;
	statusUpdatedAt?: string;
}

export interface SaveUnlockOptions {
	customerId?: string;
	subscriptionId?: string;
	plan?: string;
}

interface SubscriptionUnlockIndex {
	scanUrl: string;
	sessionId: string;
}

export function unlockKey(scanUrl: string): string {
	return stableStorageKey('unlock', canonicalScanUrl(scanUrl));
}

export function subscriptionUnlockKey(subscriptionId: string): string {
	return stableStorageKey('subscription', subscriptionId);
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
	sessionId: string,
	opts: SaveUnlockOptions = {}
): Promise<void> {
	const canonicalUrl = canonicalScanUrl(scanUrl);
	const record: UnlockRecord = {
		sessionId,
		paidAt: new Date().toISOString(),
		scanUrl: canonicalUrl,
		...(opts.customerId ? { customerId: opts.customerId } : {}),
		...(opts.subscriptionId ? { subscriptionId: opts.subscriptionId } : {}),
		...(opts.plan ? { plan: opts.plan } : {}),
		active: true,
		status: 'active',
		statusUpdatedAt: new Date().toISOString()
	};
	await kv.put(unlockKey(canonicalUrl), JSON.stringify(record), {
		expirationTtl: UNLOCK_TTL_SECONDS
	});
	if (opts.subscriptionId) {
		const index: SubscriptionUnlockIndex = { scanUrl: canonicalUrl, sessionId };
		await kv.put(subscriptionUnlockKey(opts.subscriptionId), JSON.stringify(index), {
			expirationTtl: UNLOCK_TTL_SECONDS
		});
	}
}

export async function hasUnlock(
	kv: KVNamespace,
	scanUrl: string,
	sessionId: string
): Promise<boolean> {
	const record = await loadUnlock(kv, scanUrl);
	return record?.sessionId === sessionId && record.active !== false;
}

export async function loadUnlockBySubscription(
	kv: KVNamespace,
	subscriptionId: string
): Promise<UnlockRecord | null> {
	try {
		const index = await kv.get<SubscriptionUnlockIndex>(
			subscriptionUnlockKey(subscriptionId),
			'json'
		);
		if (!index?.scanUrl || !index.sessionId) return null;
		const record = await loadUnlock(kv, index.scanUrl);
		if (!record || record.sessionId !== index.sessionId) return null;
		return record;
	} catch {
		return null;
	}
}

export async function setUnlockStatusBySubscription(
	kv: KVNamespace,
	subscriptionId: string,
	status: { active: boolean; status: UnlockStatus }
): Promise<boolean> {
	const record = await loadUnlockBySubscription(kv, subscriptionId);
	if (!record?.scanUrl) return false;

	const updated: UnlockRecord = {
		...record,
		subscriptionId: record.subscriptionId ?? subscriptionId,
		active: status.active,
		status: status.status,
		statusUpdatedAt: new Date().toISOString()
	};
	await kv.put(unlockKey(record.scanUrl), JSON.stringify(updated), {
		expirationTtl: UNLOCK_TTL_SECONDS
	});
	return true;
}
