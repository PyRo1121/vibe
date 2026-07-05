import type { ScanReport } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { evaluateGate } from './evaluate';

function report(overrides: Partial<ScanReport> = {}): ScanReport {
	return {
		url: 'https://app.test',
		finalUrl: 'https://app.test/',
		scannedAt: new Date().toISOString(),
		score: 85,
		verdict: 'go',
		verdictMessage: 'Clear to share',
		checks: [],
		summary: { pass: 10, warn: 0, fail: 0 },
		...overrides
	};
}

describe('evaluateGate', () => {
	it('passes a healthy report', () => {
		expect(evaluateGate(report()).pass).toBe(true);
	});

	it('fails on no-go verdict', () => {
		const result = evaluateGate(
			report({ verdict: 'no-go', verdictMessage: 'Blockers present', score: 40 })
		);
		expect(result.pass).toBe(false);
		expect(result.reasons.some((r) => r.includes('NO-GO'))).toBe(true);
	});

	it('fails when score is below minimum', () => {
		const result = evaluateGate(report({ score: 70 }), { minScore: 80 });
		expect(result.pass).toBe(false);
		expect(result.reasons.some((r) => r.includes('below minimum'))).toBe(true);
	});

	it('fails on P0 check failures', () => {
		const result = evaluateGate(
			report({
				checks: [
					{
						id: 'secrets',
						category: 'security',
						title: 'Exposed secrets',
						status: 'fail',
						message: 'Stripe key found',
						fixPrompt: ''
					}
				]
			})
		);
		expect(result.pass).toBe(false);
		expect(result.reasons.some((r) => r.includes('P0 blocker'))).toBe(true);
	});

	it('fails on exposed-env P0', () => {
		const result = evaluateGate(
			report({
				checks: [
					{
						id: 'exposed-env',
						category: 'security',
						title: '.env exposed',
						status: 'fail',
						message: 'Public .env file',
						fixPrompt: ''
					}
				]
			})
		);
		expect(result.pass).toBe(false);
	});
});
