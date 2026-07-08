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
		expect(
			result.findings.find((finding) => finding.id === 'deploy-job-dependencies')
		).toMatchObject({
			status: 'warn',
			shortTitle: 'Deploy dependencies'
		});
		expect(result.repairPrompt).toContain('Fix this GitHub Actions workflow');
		expect(result.repairPrompt).toContain('pull_request_target');
		expect(result.nextAction).toContain('use advisory mode first');
		expect(result.releasePlan).toEqual([
			expect.objectContaining({
				id: 'fix-blockers',
				state: 'blocked',
				title: 'Fix blocking workflow risk'
			}),
			expect.objectContaining({
				id: 'close-warnings',
				state: 'blocked'
			}),
			expect.objectContaining({
				id: 'install-advisory',
				state: 'blocked'
			}),
			expect.objectContaining({
				id: 'workspace-history',
				state: 'blocked'
			}),
			expect.objectContaining({
				id: 'promote-gate',
				state: 'blocked'
			})
		]);
	});

	it('passes least-privilege workflows with full quality gates', () => {
		const result = analyzeGithubActionsYaml(HARDENED_GITHUB_ACTIONS_WORKFLOW);

		expect(result).toMatchObject({
			score: 100,
			pass: 8,
			warn: 0,
			fail: 0,
			verdict: 'hardened'
		});
		expect(result.repairPrompt).toContain('keep the current hardening posture intact');
		expect(result.repairPrompt).toContain('full commit SHAs');
		expect(result.hardenedWorkflow).toContain('dependency-review-action');
		expect(result.hardenedWorkflow).toContain('github/codeql-action/analyze');
		expect(result.hardenedWorkflow).toContain('needs: [verify, codeql]');
		expect(result.hardenedWorkflow).toContain('# actions/checkout v7');
		expect(result.hardenedWorkflow).toContain(
			'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0'
		);
		expect(result.hardenedWorkflow).not.toContain('actions/checkout v6');
		expect(result.releasePlan).toEqual([
			expect.objectContaining({
				id: 'fix-blockers',
				state: 'ready',
				title: 'Blocking workflow risk clear'
			}),
			expect.objectContaining({
				id: 'close-warnings',
				state: 'ready',
				title: 'Hardening warnings clear'
			}),
			expect.objectContaining({
				id: 'install-advisory',
				state: 'next'
			}),
			expect.objectContaining({
				id: 'workspace-history',
				state: 'next'
			}),
			expect.objectContaining({
				id: 'promote-gate',
				state: 'next'
			})
		]);
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
		expect(result.releasePlan.map((step) => [step.id, step.state])).toEqual([
			['fix-blockers', 'ready'],
			['close-warnings', 'next'],
			['install-advisory', 'next'],
			['workspace-history', 'next'],
			['promote-gate', 'blocked']
		]);
	});
});
