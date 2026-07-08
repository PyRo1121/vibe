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
		expect(
			result.findings.find((finding) => finding.id === 'workflow-immutable-action-pins')
		).toMatchObject({
			status: 'warn',
			shortTitle: 'Immutable action pins'
		});
		expect(result.findings.find((finding) => finding.id === 'codeql-code-scanning')).toMatchObject({
			status: 'warn',
			shortTitle: 'CodeQL scanning'
		});
		expect(result.repairPrompt).toContain('Fix this GitHub Actions workflow');
		expect(result.repairPrompt).toContain('pull_request_target');
		expect(result.nextAction).toContain('use advisory mode first');
	});

	it('passes least-privilege workflows with full quality gates', () => {
		const result = analyzeGithubActionsYaml(HARDENED_GITHUB_ACTIONS_WORKFLOW);

		expect(result).toMatchObject({
			score: 100,
			pass: 7,
			warn: 0,
			fail: 0,
			verdict: 'hardened'
		});
		expect(result.repairPrompt).toContain('keep the current hardening posture intact');
		expect(result.repairPrompt).toContain('full commit SHAs');
		expect(result.hardenedWorkflow).toContain('dependency-review-action');
		expect(result.hardenedWorkflow).toContain('github/codeql-action/analyze');
	});

	it('marks least-privilege workflows with missing hardening as needs-work', () => {
		const result = analyzeGithubActionsYaml(`name: CI

on: pull_request

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test`);

		expect(result.verdict).toBe('needs-work');
		expect(result.verdictLabel).toBe('Needs work');
		expect(result.fail).toBe(0);
		expect(result.warn).toBeGreaterThan(0);
		expect(result.score).toBeGreaterThanOrEqual(60);
		expect(result.score).toBeLessThan(100);
		expect(result.nextAction).toContain('Patch the warnings');
	});
});
