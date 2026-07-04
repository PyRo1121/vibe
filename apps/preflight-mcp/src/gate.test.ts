import { describe, it, expect } from 'vitest';
import { evaluateGate } from './gate.js';

describe('evaluateGate', () => {
	it('fails on exposed-git P0', () => {
		const r = evaluateGate(
			{
				score: 90,
				verdict: 'conditional',
				verdictMessage: 'ok',
				finalUrl: 'https://x.com',
				summary: { pass: 1, warn: 0, fail: 1 },
				checks: [
					{
						id: 'exposed-git',
						title: 'Exposed .git directory',
						status: 'fail',
						message: 'bad'
					}
				]
			},
			80
		);
		expect(r.pass).toBe(false);
		expect(r.reasons.some((x: string) => x.includes('.git'))).toBe(true);
	});
});
