import type { ScanReport } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { evaluateGate, formatGateReport } from './evaluate';

function report(overrides: Partial<ScanReport> = {}): ScanReport {
	return {
		url: 'https://app.test',
		finalUrl: 'https://app.test/',
		scannedAt: new Date().toISOString(),
		score: 85,
		verdict: 'go',
		verdictMessage: 'Clear for deploy gate review',
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

	it('fails on repo security findings that are deploy blockers', () => {
		for (const id of [
			'dependency-vulns',
			'workflow-pull-request-target',
			'webhook-signature-missing',
			'docker-env-copy',
			'exposed-backup'
		]) {
			const result = evaluateGate(
				report({
					checks: [
						{
							id,
							category: 'security',
							title: id,
							status: 'fail',
							message: 'confirmed blocker',
							fixPrompt: ''
						}
					]
				})
			);
			expect(result.pass).toBe(false);
		}
	});

	it('can ignore P0 checks when configured for advisory scoring only', () => {
		const result = evaluateGate(
			report({
				score: 90,
				checks: [
					{
						id: 'privacy',
						category: 'legal',
						title: 'Privacy policy',
						status: 'fail',
						message: 'Missing privacy page',
						fixPrompt: ''
					}
				]
			}),
			{ failOnP0: false }
		);

		expect(result.pass).toBe(true);
		expect(result.reasons).toEqual([]);
	});

	it('supports custom blocking verdicts', () => {
		const result = evaluateGate(report({ verdict: 'conditional' }), {
			blockVerdicts: ['conditional']
		});

		expect(result.pass).toBe(false);
		expect(result.reasons[0]).toContain('Verdict CONDITIONAL');
	});
});

describe('formatGateReport', () => {
	it('renders pass reports without a failure section', () => {
		const text = formatGateReport(evaluateGate(report()));

		expect(text).toContain('Deploylint gate: PASS');
		expect(text).toContain('URL: https://app.test/');
		expect(text).not.toContain('Failures:');
	});

	it('renders all failure reasons for local and CI output', () => {
		const text = formatGateReport(evaluateGate(report({ verdict: 'no-go', score: 40 })));

		expect(text).toContain('Deploylint gate: FAIL');
		expect(text).toContain('Failures:');
		expect(text).toContain('Verdict NO-GO');
		expect(text).toContain('Score 40 is below minimum 80');
	});
});
