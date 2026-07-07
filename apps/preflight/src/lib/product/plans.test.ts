import { describe, expect, it } from 'vitest';

import {
	ALPHA_DISCLAIMER,
	ALPHA_FREE_DISCLAIMER,
	ALPHA_FREE_UNLOCK_ENV,
	ALPHA_PRICE_PREVIEW,
	resolveAlphaFreeUnlock
} from './alpha';
import {
	DEFAULT_DEPLOYLINT_PLAN_ID,
	DEPLOYLINT_PLANS,
	DEPLOYLINT_PLAN_LIST,
	isDeploylintPlanId,
	resolveDeploylintPlan
} from './plans';

describe('Deploylint product plans', () => {
	it('keeps the public paid tier order and Stripe env mapping stable', () => {
		expect(DEPLOYLINT_PLAN_LIST.map((plan) => plan.id)).toEqual(['solo', 'builder', 'agency']);
		expect(DEPLOYLINT_PLAN_LIST.map((plan) => plan.priceLabel)).toEqual([
			'$9/mo',
			'$29/mo',
			'$149/mo'
		]);
		expect(DEPLOYLINT_PLAN_LIST.map((plan) => plan.stripePriceEnv)).toEqual([
			'STRIPE_PRICE_SOLO',
			'STRIPE_PRICE_BUILDER',
			'STRIPE_PRICE_AGENCY'
		]);
		expect(DEPLOYLINT_PLAN_LIST.map((plan) => plan.unitAmount)).toEqual([900, 2900, 14900]);
	});

	it('defaults invalid or missing plan input to Solo', () => {
		expect(DEFAULT_DEPLOYLINT_PLAN_ID).toBe('solo');
		expect(resolveDeploylintPlan()).toBe(DEPLOYLINT_PLANS.solo);
		expect(resolveDeploylintPlan('')).toBe(DEPLOYLINT_PLANS.solo);
		expect(resolveDeploylintPlan('enterprise')).toBe(DEPLOYLINT_PLANS.solo);
		expect(resolveDeploylintPlan('builder')).toBe(DEPLOYLINT_PLANS.builder);
	});

	it('accepts only configured plan ids', () => {
		expect(isDeploylintPlanId('solo')).toBe(true);
		expect(isDeploylintPlanId('builder')).toBe(true);
		expect(isDeploylintPlanId('agency')).toBe(true);
		expect(isDeploylintPlanId('STRIPE_PRICE_SOLO')).toBe(false);
		expect(isDeploylintPlanId(null)).toBe(false);
	});

	it('leads paid value with monitored projects and deploy gates', () => {
		expect(DEPLOYLINT_PLANS.solo.features).toContain('Workspace-backed advisory reports');
		expect(DEPLOYLINT_PLANS.solo.features).toContain('Deploy gate and MCP access');
		expect(DEPLOYLINT_PLANS.builder.features).toContain(
			'Saved report history and regression alerts'
		);
		expect(DEPLOYLINT_PLANS.agency.features).toContain('Client-ready gate reports and exports');
		expect(DEPLOYLINT_PLAN_LIST.flatMap((plan) => plan.features).join(' ')).not.toMatch(
			/Full fix prompts|master repair paste/
		);
	});
});

describe('Deploylint alpha pricing mode', () => {
	it('defaults production scans to paid unlock mode', () => {
		expect(resolveAlphaFreeUnlock()).toBe(false);
		expect(resolveAlphaFreeUnlock({})).toBe(false);
		expect(resolveAlphaFreeUnlock({ [ALPHA_FREE_UNLOCK_ENV]: 'false' })).toBe(false);
		expect(ALPHA_PRICE_PREVIEW.current).toBe('Free scan, paid fix plan');
		expect(ALPHA_PRICE_PREVIEW.later).toBe('Solo starts at $9/mo');
		expect(ALPHA_DISCLAIMER).toContain('Subscriptions unlock every prompt');
	});

	it('requires an explicit env flag for alpha free unlock mode', () => {
		expect(resolveAlphaFreeUnlock({ [ALPHA_FREE_UNLOCK_ENV]: 'true' })).toBe(true);
		expect(resolveAlphaFreeUnlock({ [ALPHA_FREE_UNLOCK_ENV]: '1' })).toBe(true);
		expect(resolveAlphaFreeUnlock({ [ALPHA_FREE_UNLOCK_ENV]: 'yes' })).toBe(true);
		expect(resolveAlphaFreeUnlock({ [ALPHA_FREE_UNLOCK_ENV]: 'on' })).toBe(true);
		expect(ALPHA_FREE_DISCLAIMER).toContain('Alpha mode is enabled');
		expect(ALPHA_FREE_DISCLAIMER).toContain('checkout stays out of the way');
	});
});
