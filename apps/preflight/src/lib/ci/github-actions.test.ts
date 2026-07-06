import { describe, expect, it } from 'vitest';

import {
	HARDENED_GITHUB_ACTIONS_WORKFLOW,
	analyzeGithubActionsYaml,
	SAMPLE_GITHUB_ACTIONS_WORKFLOW
} from './github-actions';

describe('GitHub Actions hardening tool analyzer', () => {
	it('flags risky pull_request_target workflows and floating action refs', () => {
		const result = analyzeGithubActionsYaml(SAMPLE_GITHUB_ACTIONS_WORKFLOW);

		expect(result.verdict).toBe('risky');
		expect(result.fail).toBe(1);
		expect(result.warn).toBeGreaterThanOrEqual(2);
		expect(
			result.findings.find((finding) => finding.id === 'workflow-pull-request-target')
		).toMatchObject({
			status: 'fail',
			shortTitle: 'pull_request_target safety'
		});
		expect(result.repairPrompt).toContain('Fix this GitHub Actions workflow');
		expect(result.repairPrompt).toContain('pull_request_target');
		expect(result.nextAction).toContain('use advisory mode first');
	});

	it('passes least-privilege workflows with full quality gates', () => {
		const result = analyzeGithubActionsYaml(HARDENED_GITHUB_ACTIONS_WORKFLOW);

		expect(result).toMatchObject({
			score: 100,
			pass: 5,
			warn: 0,
			fail: 0,
			verdict: 'hardened'
		});
		expect(result.repairPrompt).toContain('keep the current hardening posture intact');
		expect(result.hardenedWorkflow).toContain('dependency-review-action');
	});
});
