import { isDeploylintPlanId, type DeploylintPlanId } from '$lib/product/plans';

export type FunnelEventName =
	| 'scan_completed'
	| 'rescan_completed'
	| 'checkout_started'
	| 'checkout_paid'
	| 'checkout_payment_failed'
	| 'checkout_subscription_canceled'
	| 'unlock_click'
	| 'pricing_viewed'
	| 'locked_prompt_viewed'
	| 'billing_portal_opened';

export interface FunnelPayload {
	verdict?: string;
	score?: number;
	issueCount?: number;
	unlocked?: boolean;
	scoreDelta?: number;
	plan?: DeploylintPlanId;
	mode?: 'alpha' | 'paid' | 'workspace';
}

const ALLOWED_EVENTS = new Set<string>([
	'scan_completed',
	'rescan_completed',
	'checkout_started',
	'checkout_paid',
	'checkout_payment_failed',
	'checkout_subscription_canceled',
	'unlock_click',
	'pricing_viewed',
	'locked_prompt_viewed',
	'billing_portal_opened'
]);

export function isFunnelEventName(value: string): value is FunnelEventName {
	return ALLOWED_EVENTS.has(value);
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
	if (raw.mode === 'alpha' || raw.mode === 'paid' || raw.mode === 'workspace')
		payload.mode = raw.mode;

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
