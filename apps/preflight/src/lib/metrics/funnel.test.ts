import { describe, expect, it } from 'vitest';

import { isFunnelEventName, sanitizeFunnelPayload } from './funnel';

describe('funnel metrics', () => {
	it('accepts known events', () => {
		expect(isFunnelEventName('scan_completed')).toBe(true);
		expect(isFunnelEventName('checkout_payment_failed')).toBe(true);
		expect(isFunnelEventName('checkout_subscription_canceled')).toBe(true);
		expect(isFunnelEventName('pricing_viewed')).toBe(true);
		expect(isFunnelEventName('locked_prompt_viewed')).toBe(true);
		expect(isFunnelEventName('billing_portal_opened')).toBe(true);
		expect(isFunnelEventName('page_view')).toBe(true);
		expect(isFunnelEventName('scan_started')).toBe(true);
		expect(isFunnelEventName('scan_failed')).toBe(true);
		expect(isFunnelEventName('capacity_reached')).toBe(true);
		expect(isFunnelEventName('free_report_viewed')).toBe(true);
		expect(isFunnelEventName('repair_plan_viewed')).toBe(true);
		expect(isFunnelEventName('verification_proof_viewed')).toBe(true);
		expect(isFunnelEventName('project_setup_started')).toBe(true);
		expect(isFunnelEventName('workspace_opened')).toBe(true);
		expect(isFunnelEventName('workflow_copied')).toBe(true);
		expect(isFunnelEventName('gate_config_viewed')).toBe(true);
		expect(isFunnelEventName('share_copied')).toBe(true);
		expect(isFunnelEventName('prompt_copied')).toBe(true);
		expect(isFunnelEventName('evil')).toBe(false);
	});

	it('sanitizes numeric bounds', () => {
		expect(sanitizeFunnelPayload({ score: 150, issueCount: -3, scoreDelta: 12.7 })).toEqual({
			score: 100,
			issueCount: 0,
			scoreDelta: 13
		});
	});

	it('allows only known plan ids', () => {
		expect(sanitizeFunnelPayload({ plan: 'builder' })).toEqual({ plan: 'builder' });
		expect(sanitizeFunnelPayload({ plan: 'enterprise' })).toEqual({});
	});

	it('allows only known pricing modes', () => {
		expect(sanitizeFunnelPayload({ mode: 'paid' })).toEqual({ mode: 'paid' });
		expect(sanitizeFunnelPayload({ mode: 'alpha' })).toEqual({ mode: 'alpha' });
		expect(sanitizeFunnelPayload({ mode: 'free' })).toEqual({ mode: 'free' });
		expect(sanitizeFunnelPayload({ mode: 'trial' })).toEqual({});
	});

	it('keeps learning fields coarse and drops raw identifiers', () => {
		expect(
			sanitizeFunnelPayload({
				surface: 'review',
				targetType: 'deploy_and_repo',
				scoreBucket: '80-100',
				blockerCount: 2,
				warnCount: 3.4,
				failCount: -1,
				checkCategory: 'security',
				gateMode: 'advisory',
				source: 'ci',
				feature: 'workflow',
				reason: 'daily_scan_capacity_reached',
				url: 'https://customer.example.com',
				repoUrl: 'https://github.com/acme/private',
				email: 'buyer@example.com',
				ingestToken: 'dlint_secret'
			})
		).toEqual({
			surface: 'review',
			targetType: 'deploy_and_repo',
			scoreBucket: '80-100',
			blockerCount: 2,
			warnCount: 3,
			failCount: 0,
			checkCategory: 'security',
			gateMode: 'advisory',
			source: 'ci',
			feature: 'workflow',
			reason: 'daily_scan_capacity_reached'
		});
	});
});
