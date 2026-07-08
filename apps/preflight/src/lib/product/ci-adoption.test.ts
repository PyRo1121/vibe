import type { ScanReport } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { buildCiAdoptionState } from './ci-adoption';

function report(overrides: Partial<ScanReport> = {}): ScanReport {
	return {
		url: 'https://app.example.com',
		finalUrl: 'https://app.example.com/',
		scannedAt: '2026-07-08T00:00:00.000Z',
		score: 72,
		verdict: 'conditional',
		verdictMessage: 'Fix blockers before gate mode.',
		checks: [],
		summary: { pass: 12, warn: 3, fail: 1 },
		...overrides
	};
}

describe('CI adoption state', () => {
	it('starts URL-only decisions at repository connection', () => {
		const state = buildCiAdoptionState(report());

		expect(state.summary).toContain('Attach the repository');
		expect(state.nextAction).toContain('connect the GitHub repository');
		expect(state.steps.map((step) => [step.id, step.status])).toEqual([
			['decision', 'complete'],
			['advisory', 'current'],
			['required-check', 'queued'],
			['gate-mode', 'queued']
		]);
	});

	it('keeps repo-backed first reports in advisory mode', () => {
		const state = buildCiAdoptionState(
			report({
				repo: {
					owner: 'acme',
					repo: 'app',
					branch: 'main',
					description: null,
					stars: 12,
					license: 'MIT',
					filesSampled: ['package.json'],
					depCount: 4
				}
			})
		);

		expect(state.summary).toContain('first advisory PR report');
		expect(state.nextAction).toContain('Copy the advisory workflow');
		expect(state.steps.map((step) => [step.id, step.status])).toEqual([
			['decision', 'complete'],
			['advisory', 'current'],
			['required-check', 'queued'],
			['gate-mode', 'queued']
		]);
	});

	it('moves repeated but failing reports to required-check preparation', () => {
		const state = buildCiAdoptionState(
			report({
				repo: {
					owner: 'acme',
					repo: 'app',
					branch: 'main',
					description: null,
					stars: 12,
					license: 'MIT',
					filesSampled: ['package.json'],
					depCount: 4
				},
				history: [{ id: 'r1', score: 66, verdict: 'conditional', at: '2026-07-07T00:00:00.000Z' }]
			})
		);

		expect(state.summary).toContain('Keep Deploylint advisory');
		expect(state.nextAction).toContain('Fix the remaining blockers');
		expect(state.steps.map((step) => [step.id, step.status])).toEqual([
			['decision', 'complete'],
			['advisory', 'complete'],
			['required-check', 'current'],
			['gate-mode', 'queued']
		]);
	});

	it('moves clean repeated reports to gate mode', () => {
		const state = buildCiAdoptionState(
			report({
				score: 94,
				verdict: 'go',
				summary: { pass: 20, warn: 0, fail: 0 },
				repo: {
					owner: 'acme',
					repo: 'app',
					branch: 'main',
					description: null,
					stars: 12,
					license: 'MIT',
					filesSampled: ['package.json'],
					depCount: 4
				},
				scanDiff: { fixed: ['ci'], regressed: [] }
			})
		);

		expect(state.summary).toContain('switch the workflow to gate mode');
		expect(state.nextAction).toContain('DEPLOYLINT_MODE');
		expect(state.steps.map((step) => [step.id, step.status])).toEqual([
			['decision', 'complete'],
			['advisory', 'complete'],
			['required-check', 'complete'],
			['gate-mode', 'current']
		]);
	});
});
