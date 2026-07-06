import { isDeploylintPlanId, type DeploylintPlanId } from '$lib/product/plans';

export type FunnelEventName =
	| 'scan_completed'
	| 'rescan_completed'
	| 'checkout_started'
	| 'checkout_paid'
	| 'checkout_payment_failed'
	| 'checkout_subscription_canceled'
	| 'unlock_click';

export interface FunnelPayload {
	verdict?: string;
	score?: number;
	issueCount?: number;
	unlocked?: boolean;
	scoreDelta?: number;
	plan?: DeploylintPlanId;
}

const ALLOWED_EVENTS = new Set<FunnelEventName>([
	'scan_completed',
	'rescan_completed',
	'checkout_started',
	'checkout_paid',
	'checkout_payment_failed',
	'checkout_subscription_canceled',
	'unlock_click'
]);

export function isFunnelEventName(value: string): value is FunnelEventName {
	return ALLOWED_EVENTS.has(value as FunnelEventName);
}

export function sanitizeFunnelPayload(raw: Record<string, unknown>): FunnelPayload {
	const payload: FunnelPayload = {};

	if (typeof raw.verdict === 'string' && raw.verdict.length <= 20) {
		payload.verdict = raw.verdict;
	}
	if (typeof raw.score === 'number' && Number.isFinite(raw.score)) {
		payload.score = Math.max(0, Math.min(100, Math.round(raw.score)));
	}
	if (typeof raw.issueCount === 'number' && Number.isFinite(raw.issueCount)) {
		payload.issueCount = Math.max(0, Math.round(raw.issueCount));
	}
	if (typeof raw.unlocked === 'boolean') payload.unlocked = raw.unlocked;
	if (typeof raw.scoreDelta === 'number' && Number.isFinite(raw.scoreDelta)) {
		payload.scoreDelta = Math.round(raw.scoreDelta);
	}
	if (isDeploylintPlanId(raw.plan)) payload.plan = raw.plan;

	return payload;
}

/** Structured logs — search Cloudflare Observability for `preflight_funnel`. */
export function logFunnelEvent(name: FunnelEventName, payload: FunnelPayload = {}): void {
	console.log(
		JSON.stringify({
			type: 'preflight_funnel',
			event: name,
			...payload,
			ts: new Date().toISOString()
		})
	);
}
