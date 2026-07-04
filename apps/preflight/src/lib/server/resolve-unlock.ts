import { hasUnlock, saveUnlock } from '$lib/billing/unlock-store';
import { verifyCheckoutSession } from '$lib/billing/stripe';

/**
 * Resolve paid unlock for a scan URL + Stripe session id.
 * KV cache (written by webhook or prior verify) avoids Stripe API on re-scans.
 */
export async function resolveUnlock(opts: {
	kv?: KVNamespace;
	stripeKey?: string;
	scanUrl: string;
	sessionId: string;
}): Promise<boolean> {
	const { kv, stripeKey, scanUrl, sessionId } = opts;

	if (kv && (await hasUnlock(kv, scanUrl, sessionId))) {
		return true;
	}

	if (!stripeKey) return false;

	const ok = await verifyCheckoutSession(sessionId, scanUrl, stripeKey);
	if (ok && kv) await saveUnlock(kv, scanUrl, sessionId);
	return ok;
}
