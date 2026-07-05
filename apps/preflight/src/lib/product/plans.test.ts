import { describe, expect, it } from 'vitest';

import { ALPHA_DISCLAIMER, ALPHA_FREE_UNLOCK, ALPHA_PRICE_PREVIEW } from './alpha';
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
});

describe('Deploylint alpha pricing mode', () => {
	it('keeps checkout out of the way while reports are free', () => {
		expect(ALPHA_FREE_UNLOCK).toBe(true);
		expect(ALPHA_PRICE_PREVIEW.current).toBe('Full reports free right now');
		expect(ALPHA_PRICE_PREVIEW.later).toBe('Solo starts at $9/mo when billing turns on');
		expect(ALPHA_DISCLAIMER).toContain('Full reports are free');
		expect(ALPHA_DISCLAIMER).toContain('checkout stays out of the way');
	});
});
