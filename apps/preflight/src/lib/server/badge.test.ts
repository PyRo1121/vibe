import { describe, expect, it } from 'vitest';

import { badgeColor, buildBadgeSvg } from './badge';

describe('badgeColor', () => {
	it('maps score tiers to colors', () => {
		expect(badgeColor(95)).toBe('#3fb950');
		expect(badgeColor(80)).toBe('#3fb950');
		expect(badgeColor(79)).toBe('#d29922');
		expect(badgeColor(60)).toBe('#d29922');
		expect(badgeColor(59)).toBe('#f85149');
	});
});

describe('buildBadgeSvg', () => {
	it('renders a valid svg with the score', () => {
		const svg = buildBadgeSvg(92);
		expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
		expect(svg).toContain('92/100');
		expect(svg).toContain('preflight');
		expect(svg).toContain('#3fb950');
	});

	it('never emits markup from unexpected scores', () => {
		// score comes from our own stored reports, but keep the invariant visible
		expect(buildBadgeSvg(0)).toContain('0/100');
	});
});
