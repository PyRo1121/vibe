import { describe, expect, it } from 'vitest';

import { evaluateGate } from './gate.js';
import type { GateScanReport } from './gate.js';

function report(overrides: Partial<GateScanReport> = {}): GateScanReport {
	return {
		score: 90,
		verdict: 'conditional',
		verdictMessage: 'Minor issues remain',
		finalUrl: 'https://app.test',
		summary: { pass: 10, warn: 1, fail: 0 },
		checks: [],
		...overrides
	};
}

describe('evaluateGate', () => {
	it('passes a healthy report at the configured score floor', () => {
		expect(evaluateGate(report({ score: 92, verdict: 'go' }), 90)).toEqual({
			pass: true,
			reasons: []
		});
	});

	it('fails on no-go verdicts and low scores', () => {
		const r = evaluateGate(
			report({
				score: 73,
				verdict: 'no-go',
				verdictMessage: 'Public blockers remain'
			}),
			80
		);

		expect(r.pass).toBe(false);
		expect(r.reasons).toContain('NO-GO: Public blockers remain');
		expect(r.reasons).toContain('Score 73 below minimum 80');
	});

	it('fails on exposed-git P0', () => {
		const r = evaluateGate(
			report({
				summary: { pass: 9, warn: 0, fail: 1 },
				checks: [
					{
						id: 'exposed-git',
						title: 'Exposed .git directory',
						status: 'fail',
						message: 'bad'
					}
				]
			}),
			80
		);
		expect(r.pass).toBe(false);
		expect(r.reasons.some((x: string) => x.includes('.git'))).toBe(true);
	});

	it('fails on repo-security P0 findings', () => {
		const r = evaluateGate(
			report({
				verdict: 'go',
				summary: { pass: 9, warn: 0, fail: 1 },
				checks: [
					{
						id: 'webhook-signature-missing',
						title: 'Webhook signature verification',
						status: 'fail',
						message: 'unsigned webhook'
					}
				]
			}),
			80
		);

		expect(r.pass).toBe(false);
		expect(r.reasons.some((x: string) => x.includes('Webhook signature'))).toBe(true);
	});

	it('does not block on non-P0 failed checks when the score and verdict pass', () => {
		const r = evaluateGate(
			report({
				verdict: 'go',
				summary: { pass: 9, warn: 0, fail: 1 },
				checks: [
					{
						id: 'minor-copy',
						title: 'Minor copy polish',
						status: 'fail',
						message: 'CTA could be clearer',
						priority: 'p2'
					}
				]
			}),
			80
		);

		expect(r).toEqual({ pass: true, reasons: [] });
	});
});
