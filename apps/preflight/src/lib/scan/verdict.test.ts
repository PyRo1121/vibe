import { describe, expect, it } from 'vitest';

import { makeCheck } from './score';
import { checkPriority, computeVerdict, sortChecksByPriority, tagCheckPriorities } from './verdict';

describe('checkPriority', () => {
	it('marks blockers as p0', () => {
		expect(checkPriority('secrets')).toBe('p0');
		expect(checkPriority('privacy')).toBe('p0');
	});

	it('marks shareability issues as p1', () => {
		expect(checkPriority('open-graph')).toBe('p1');
		expect(checkPriority('viewport')).toBe('p1');
	});

	it('classifies new depth checks', () => {
		expect(checkPriority('form-security')).toBe('p0');
		expect(checkPriority('default-favicon-title')).toBe('p1');
		// Heuristic depth checks stay advisory
		expect(checkPriority('primary-cta')).toBe('p2');
		expect(checkPriority('ai-crawlers')).toBe('p2');
		expect(checkPriority('ci-config')).toBe('p2');
	});
});

describe('computeVerdict', () => {
	it('returns no-go when p0 fails', () => {
		const checks = tagCheckPriorities([
			makeCheck('privacy', 'legal', 'Privacy', 'fail', 'Missing', 'fix'),
			makeCheck('favicon', 'seo', 'Favicon', 'warn', 'Missing', 'fix')
		]);
		const result = computeVerdict(checks, 40);
		expect(result.verdict).toBe('no-go');
		expect(result.verdictMessage).toContain('Do not enable gate mode');
	});

	it('tags failing server-owned checkout as p0 and returns no-go', () => {
		const checks = tagCheckPriorities([
			makeCheck(
				'checkout-server-owned',
				'payments',
				'Checkout is server-owned',
				'fail',
				'Client creates checkout',
				'fix'
			)
		]);

		expect(checks[0].priority).toBe('p0');
		expect(computeVerdict(checks, 90).verdict).toBe('no-go');
	});

	it('returns go for clean high score', () => {
		const checks = tagCheckPriorities([
			makeCheck('privacy', 'legal', 'Privacy', 'pass', 'ok', 'fix'),
			makeCheck('title', 'seo', 'Title', 'pass', 'ok', 'fix')
		]);
		const result = computeVerdict(checks, 90);
		expect(result.verdict).toBe('go');
		expect(result.verdictMessage).toBe('Clear for deploy gate review.');
	});

	it('returns conditional for low score without p0 fails', () => {
		const checks = tagCheckPriorities([
			makeCheck('privacy', 'legal', 'Privacy', 'pass', 'ok', 'fix'),
			makeCheck('favicon', 'seo', 'Favicon', 'warn', 'Missing', 'fix')
		]);
		const result = computeVerdict(checks, 55);
		expect(result.verdict).toBe('conditional');
		expect(result.verdictMessage).toContain('required deploy gates');
	});

	it('returns conditional for p1 fail even with decent score', () => {
		const checks = tagCheckPriorities([
			makeCheck('privacy', 'legal', 'Privacy', 'pass', 'ok', 'fix'),
			makeCheck('viewport', 'mobile', 'Viewport', 'fail', 'Missing', 'fix')
		]);
		expect(computeVerdict(checks, 75).verdict).toBe('conditional');
	});

	it('sorts failing checks by priority', () => {
		const checks = tagCheckPriorities([
			makeCheck('favicon', 'seo', 'Favicon', 'warn', 'Missing', 'fix'),
			makeCheck('privacy', 'legal', 'Privacy', 'fail', 'Missing', 'fix')
		]);
		expect(sortChecksByPriority(checks).map((c) => c.id)).toEqual(['privacy', 'favicon']);
	});
});
