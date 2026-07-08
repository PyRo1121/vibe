export const DEFAULT_DEPLOYLINT_PLAN_ID = 'solo';

export const DEPLOYLINT_PLANS = {
	solo: {
		id: 'solo',
		name: 'Solo',
		priceLabel: '$9/mo',
		unitAmount: 900,
		stripePriceEnv: 'STRIPE_PRICE_SOLO',
		tagline: 'For one monitored project moving toward production.',
		limits: '1 monitored project',
		cadence: 'Weekly monitoring',
		features: [
			'Workspace-backed advisory reports',
			'CI gate, MCP workflow access, and readiness evidence',
			'10 full reports per month'
		],
		ctaLabel: 'Start Solo - $9/mo'
	},
	builder: {
		id: 'builder',
		name: 'Builder',
		priceLabel: '$29/mo',
		unitAmount: 2900,
		stripePriceEnv: 'STRIPE_PRICE_BUILDER',
		tagline: 'For builders running several projects or client experiments.',
		limits: '5 monitored projects',
		cadence: 'Daily monitoring',
		features: [
			'Everything in Solo',
			'Saved readiness history and regression alerts',
			'CVE and readiness drift monitoring'
		],
		ctaLabel: 'Start Builder - $29/mo'
	},
	agency: {
		id: 'agency',
		name: 'Agency',
		priceLabel: '$149/mo',
		unitAmount: 14900,
		stripePriceEnv: 'STRIPE_PRICE_AGENCY',
		tagline: 'For teams hardening multiple client projects.',
		limits: '25 monitored projects',
		cadence: 'Daily monitoring',
		features: [
			'Everything in Builder',
			'Client-ready readiness briefs and exports',
			'Webhook-ready alert workflow'
		],
		ctaLabel: 'Start Agency - $149/mo'
	}
} as const;

export type DeploylintPlanId = keyof typeof DEPLOYLINT_PLANS;
export type DeploylintPlan = (typeof DEPLOYLINT_PLANS)[DeploylintPlanId];

export const DEPLOYLINT_PLAN_LIST = Object.values(DEPLOYLINT_PLANS);

export function isDeploylintPlanId(value: unknown): value is DeploylintPlanId {
	return typeof value === 'string' && value in DEPLOYLINT_PLANS;
}

export function resolveDeploylintPlan(value?: unknown): DeploylintPlan {
	if (isDeploylintPlanId(value)) return DEPLOYLINT_PLANS[value];
	return DEPLOYLINT_PLANS[DEFAULT_DEPLOYLINT_PLAN_ID];
}
