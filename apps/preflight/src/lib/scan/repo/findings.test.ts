import { describe, expect, it } from 'vitest';

import { mergeRepoFindings, normalizeRepoFinding, type RepoFinding } from './findings';

describe('repo findings', () => {
	it('adds stable default metadata to static findings', () => {
		const finding = normalizeRepoFinding({
			id: 'ci-runs-quality-gates',
			category: 'launch',
			title: 'CI quality gates',
			status: 'warn',
			message: 'GitHub Actions workflow is missing quality gates: test.'
		});

		expect(finding).toMatchObject({
			id: 'ci-runs-quality-gates',
			ruleId: 'ci-runs-quality-gates',
			engine: 'deploylint-static',
			confidence: 'high',
			launchImpact: 'fix-soon'
		});
		expect(finding.fingerprint).toBe('deploylint-static:ci-runs-quality-gates');
	});

	it('treats known blocker failures as deploy blockers', () => {
		const finding = normalizeRepoFinding({
			id: 'webhook-signature-missing',
			category: 'payments',
			title: 'Webhook signature verification',
			status: 'fail',
			message: 'Stripe webhook handler does not verify signatures.'
		});

		expect(finding.launchImpact).toBe('blocker');
	});

	it('treats deploy dependency gaps as fix-soon launch risks', () => {
		for (const id of ['deploy-job-dependencies', 'deploy-job-environment']) {
			const finding = normalizeRepoFinding({
				id,
				category: 'launch',
				title: 'Deploy job hardening',
				status: 'warn',
				message: 'Deploy job is missing production hardening.'
			});

			expect(finding.launchImpact).toBe('fix-soon');
			expect(finding.fixPromptId).toBe(id);
		}
	});

	it('keeps explicit launch-impact overrides', () => {
		const finding = normalizeRepoFinding({
			id: 'dependency-review-action',
			category: 'security',
			title: 'Dependency review action',
			status: 'warn',
			message: 'No dependency review action found.',
			launchImpact: 'watch'
		});

		expect(finding.launchImpact).toBe('watch');
	});

	it('merges duplicate findings by severity and launch impact', () => {
		const findings: RepoFinding[] = [
			normalizeRepoFinding({
				id: 'workflow-pull-request-target',
				category: 'security',
				title: 'pull_request_target safety',
				status: 'warn',
				message: 'Review pull_request_target usage.'
			}),
			normalizeRepoFinding({
				id: 'workflow-pull-request-target',
				category: 'security',
				title: 'pull_request_target safety',
				status: 'fail',
				message: 'pull_request_target checks out untrusted fork code.',
				launchImpact: 'blocker'
			})
		];

		expect(mergeRepoFindings(findings)).toEqual([
			expect.objectContaining({
				id: 'workflow-pull-request-target',
				status: 'fail',
				launchImpact: 'blocker'
			})
		]);
	});
});
