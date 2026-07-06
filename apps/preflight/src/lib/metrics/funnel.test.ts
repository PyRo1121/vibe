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
		expect(sanitizeFunnelPayload({ mode: 'trial' })).toEqual({});
	});
});
