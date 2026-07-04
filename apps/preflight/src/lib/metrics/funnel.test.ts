import { describe, expect, it } from 'vitest';
import { isFunnelEventName, sanitizeFunnelPayload } from './funnel';

describe('funnel metrics', () => {
	it('accepts known events', () => {
		expect(isFunnelEventName('scan_completed')).toBe(true);
		expect(isFunnelEventName('evil')).toBe(false);
	});

	it('sanitizes numeric bounds', () => {
		expect(sanitizeFunnelPayload({ score: 150, issueCount: -3, scoreDelta: 12.7 })).toEqual({
			score: 100,
			issueCount: 0,
			scoreDelta: 13
		});
	});
});
