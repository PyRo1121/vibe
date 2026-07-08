import { isDeploylintPlanId, type DeploylintPlanId } from '$lib/product/plans';

export type FunnelEventName =
	| 'page_view'
	| 'scan_started'
	| 'scan_completed'
	| 'rescan_completed'
	| 'scan_failed'
	| 'capacity_reached'
	| 'checkout_started'
	| 'checkout_paid'
	| 'checkout_payment_failed'
	| 'checkout_subscription_canceled'
	| 'unlock_click'
	| 'pricing_viewed'
	| 'locked_prompt_viewed'
	| 'billing_portal_opened'
	| 'free_report_viewed'
	| 'repair_plan_viewed'
	| 'verification_proof_viewed'
	| 'project_setup_started'
	| 'workspace_opened'
	| 'workflow_copied'
	| 'gate_config_viewed'
	| 'share_copied'
	| 'prompt_copied';

type FunnelMode = 'alpha' | 'free' | 'paid' | 'workspace';
type FunnelSurface = 'home' | 'review' | 'workspace' | 'developers' | 'tools' | 'api' | 'ci';
type FunnelTargetType = 'deploy_url' | 'github_repo' | 'deploy_and_repo' | 'unknown';
type FunnelScoreBucket = '0-49' | '50-79' | '80-100';
type FunnelCheckCategory =
	| 'seo'
	| 'security'
	| 'legal'
	| 'payments'
	| 'launch'
	| 'a11y'
	| 'performance'
	| 'repo'
	| 'workflow'
	| 'trust'
	| 'unknown';
type FunnelGateMode = 'advisory' | 'gate';
type FunnelSource = 'browser' | 'ci' | 'api';
type FunnelFeature =
	| 'scan'
	| 'report'
	| 'repair_plan'
	| 'verification'
	| 'workspace'
	| 'workflow'
	| 'gate'
	| 'share'
	| 'billing';
type FunnelReason =
	| 'daily_scan_capacity_reached'
	| 'scan_error'
	| 'invalid_input'
	| 'checkout_disabled_free'
	| 'user_action';

export interface FunnelPayload {
	verdict?: string;
	score?: number;
	issueCount?: number;
	blockerCount?: number;
	warnCount?: number;
	failCount?: number;
	unlocked?: boolean;
	scoreDelta?: number;
	plan?: DeploylintPlanId;
	mode?: FunnelMode;
	surface?: FunnelSurface;
	targetType?: FunnelTargetType;
	scoreBucket?: FunnelScoreBucket;
	checkCategory?: FunnelCheckCategory;
	gateMode?: FunnelGateMode;
	source?: FunnelSource;
	feature?: FunnelFeature;
	reason?: FunnelReason;
}

const ALLOWED_EVENTS = new Set<string>([
	'page_view',
	'scan_started',
	'scan_completed',
	'rescan_completed',
	'scan_failed',
	'capacity_reached',
	'checkout_started',
	'checkout_paid',
	'checkout_payment_failed',
	'checkout_subscription_canceled',
	'unlock_click',
	'pricing_viewed',
	'locked_prompt_viewed',
	'billing_portal_opened',
	'free_report_viewed',
	'repair_plan_viewed',
	'verification_proof_viewed',
	'project_setup_started',
	'workspace_opened',
	'workflow_copied',
	'gate_config_viewed',
	'share_copied',
	'prompt_copied'
]);

const ALLOWED_MODES: ReadonlySet<string> = new Set<FunnelMode>([
	'alpha',
	'free',
	'paid',
	'workspace'
]);
const ALLOWED_SURFACES: ReadonlySet<string> = new Set<FunnelSurface>([
	'home',
	'review',
	'workspace',
	'developers',
	'tools',
	'api',
	'ci'
]);
const ALLOWED_TARGET_TYPES: ReadonlySet<string> = new Set<FunnelTargetType>([
	'deploy_url',
	'github_repo',
	'deploy_and_repo',
	'unknown'
]);
const ALLOWED_SCORE_BUCKETS: ReadonlySet<string> = new Set<FunnelScoreBucket>([
	'0-49',
	'50-79',
	'80-100'
]);
const ALLOWED_CHECK_CATEGORIES: ReadonlySet<string> = new Set<FunnelCheckCategory>([
	'seo',
	'security',
	'legal',
	'payments',
	'launch',
	'a11y',
	'performance',
	'repo',
	'workflow',
	'trust',
	'unknown'
]);
const ALLOWED_GATE_MODES: ReadonlySet<string> = new Set<FunnelGateMode>(['advisory', 'gate']);
const ALLOWED_SOURCES: ReadonlySet<string> = new Set<FunnelSource>(['browser', 'ci', 'api']);
const ALLOWED_FEATURES: ReadonlySet<string> = new Set<FunnelFeature>([
	'scan',
	'report',
	'repair_plan',
	'verification',
	'workspace',
	'workflow',
	'gate',
	'share',
	'billing'
]);
const ALLOWED_REASONS: ReadonlySet<string> = new Set<FunnelReason>([
	'daily_scan_capacity_reached',
	'scan_error',
	'invalid_input',
	'checkout_disabled_free',
	'user_action'
]);

export function isFunnelEventName(value: string): value is FunnelEventName {
	return ALLOWED_EVENTS.has(value);
}

function sanitizeCount(value: unknown): number | undefined {
	if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
	return Math.max(0, Math.round(value));
}

function isAllowedString(value: unknown, allowed: ReadonlySet<string>): value is string {
	return typeof value === 'string' && allowed.has(value);
}

function isFunnelMode(value: unknown): value is FunnelMode {
	return isAllowedString(value, ALLOWED_MODES);
}

function isFunnelSurface(value: unknown): value is FunnelSurface {
	return isAllowedString(value, ALLOWED_SURFACES);
}

function isFunnelTargetType(value: unknown): value is FunnelTargetType {
	return isAllowedString(value, ALLOWED_TARGET_TYPES);
}

function isFunnelScoreBucket(value: unknown): value is FunnelScoreBucket {
	return isAllowedString(value, ALLOWED_SCORE_BUCKETS);
}

function isFunnelCheckCategory(value: unknown): value is FunnelCheckCategory {
	return isAllowedString(value, ALLOWED_CHECK_CATEGORIES);
}

function isFunnelGateMode(value: unknown): value is FunnelGateMode {
	return isAllowedString(value, ALLOWED_GATE_MODES);
}

function isFunnelSource(value: unknown): value is FunnelSource {
	return isAllowedString(value, ALLOWED_SOURCES);
}

function isFunnelFeature(value: unknown): value is FunnelFeature {
	return isAllowedString(value, ALLOWED_FEATURES);
}

function isFunnelReason(value: unknown): value is FunnelReason {
	return isAllowedString(value, ALLOWED_REASONS);
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
	const blockerCount = sanitizeCount(raw.blockerCount);
	if (blockerCount !== undefined) payload.blockerCount = blockerCount;
	const warnCount = sanitizeCount(raw.warnCount);
	if (warnCount !== undefined) payload.warnCount = warnCount;
	const failCount = sanitizeCount(raw.failCount);
	if (failCount !== undefined) payload.failCount = failCount;
	if (typeof raw.unlocked === 'boolean') payload.unlocked = raw.unlocked;
	if (typeof raw.scoreDelta === 'number' && Number.isFinite(raw.scoreDelta)) {
		payload.scoreDelta = Math.round(raw.scoreDelta);
	}
	if (isDeploylintPlanId(raw.plan)) payload.plan = raw.plan;
	if (isFunnelMode(raw.mode)) payload.mode = raw.mode;
	if (isFunnelSurface(raw.surface)) payload.surface = raw.surface;
	if (isFunnelTargetType(raw.targetType)) payload.targetType = raw.targetType;
	if (isFunnelScoreBucket(raw.scoreBucket)) payload.scoreBucket = raw.scoreBucket;
	if (isFunnelCheckCategory(raw.checkCategory)) payload.checkCategory = raw.checkCategory;
	if (isFunnelGateMode(raw.gateMode)) payload.gateMode = raw.gateMode;
	if (isFunnelSource(raw.source)) payload.source = raw.source;
	if (isFunnelFeature(raw.feature)) payload.feature = raw.feature;
	if (isFunnelReason(raw.reason)) payload.reason = raw.reason;

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
