import { describe, expect, it } from 'vitest';

import { formatUsd } from './format';

describe('formatUsd', () => {
	it('formats numeric values as US dollars', () => {
		expect(formatUsd(12.5)).toBe('$12.50');
	});

	it('uses an empty placeholder for missing or invalid values', () => {
		expect(formatUsd(null)).toBe('\u2014');
		expect(formatUsd(undefined)).toBe('\u2014');
		expect(formatUsd(Number.NaN)).toBe('\u2014');
	});
});
