import { describe, expect, it } from 'vitest';

import {
	buildAdvisoryWorkflow,
	buildWorkspaceCommandCenterStats,
	buildProjectDraftFromSearchParams,
	buildWorkspaceSetupState,
	buildWorkspaceGatePolicy,
	buildWorkspaceActivation,
	workspaceActivationSteps,
	workspaceGateHardeningSteps
} from './workspace';

describe('Deploylint workspace model', () => {
	it('builds a project-shaped default workspace instead of a URL scan session', () => {
		const workspace = buildWorkspaceSetupState({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: true
		});

		expect(workspace.ownerLabel).toBe('Early access workspace');
		expect(workspace.storageStatus).toBe('available');
		expect(workspace.billing.mode).toBe('alpha');
		expect(workspace.projects).toHaveLength(1);
		expect(workspace.projects[0]).toMatchObject({
			name: 'First deploy target',
			deployUrl: 'https://your-app.com',
			installState: 'not_installed',
			gateMode: 'advisory'
		});
		expect(workspace.projects[0].latestReport).toBeNull();
		expect(workspace.metrics).toMatchObject({
			activeProjects: 1,
			gatesEnabled: 0,
			reportsThisMonth: 0
		});
	});

	it('generates a project-scoped readiness workflow for the install loop', () => {
		const workflow = buildAdvisoryWorkflow({
			appUrl: 'https://deploylint.com/',
			projectId: 'proj_demo_123',
			deployUrl: 'https://app.example.com',
			repoLabel: 'github.com/acme/app',
			minScore: 80
		});

		expect(workflow).toContain('name: Deploylint readiness report');
		expect(workflow).toContain('permissions:');
		expect(workflow).toContain('contents: read');
		expect(workflow).toContain('pull-requests: write');
		expect(workflow).toContain('DEPLOYLINT_PROJECT_ID: proj_demo_123');
		expect(workflow).toContain('DEPLOYLINT_INGEST_TOKEN: ${{ secrets.DEPLOYLINT_INGEST_TOKEN }}');
		expect(workflow).toContain('DEPLOYLINT_URL: https://app.example.com');
		expect(workflow).toContain('DEPLOYLINT_REPO_URL: github.com/acme/app');
		expect(workflow).toContain('DEPLOYLINT_MODE: advisory');
		expect(workflow).toContain('DEPLOYLINT_API: https://deploylint.com');
		expect(workflow).toContain('GITHUB_TOKEN: ${{ github.token }}');
		expect(workflow).toContain('if [ -z "$DEPLOYLINT_URL" ]; then');
		expect(workflow).toContain(
			'Skipping Deploylint readiness report because DEPLOYLINT_URL is unavailable'
		);
		expect(workflow).toContain('if [ -z "$DEPLOYLINT_INGEST_TOKEN" ]; then');
		expect(workflow).toContain('DEPLOYLINT_INGEST_TOKEN is unavailable');
		expect(workflow).toContain('Continuing without Deploylint workspace history');
		expect(workflow).toContain('node gate-remote.mjs "$DEPLOYLINT_URL"');
	});

	it('generates gate-mode workflow config after workspace promotion', () => {
		const workflow = buildAdvisoryWorkflow({
			appUrl: 'https://deploylint.com',
			projectId: 'proj_demo_123',
			deployUrl: 'https://app.example.com',
			mode: 'gate',
			minScore: 90
		});

		expect(workflow).toContain('DEPLOYLINT_MODE: gate');
		expect(workflow).toContain("DEPLOYLINT_MIN_SCORE: '90'");
		expect(workflow).toContain('DEPLOYLINT_INGEST_TOKEN is required for Deploylint gate mode');
		expect(workflow).toContain('exit 2');
		expect(workflow).not.toContain('DEPLOYLINT_MODE: advisory');
	});

	it('uses the project score threshold in the advisory workflow', () => {
		const workflow = buildAdvisoryWorkflow({
			appUrl: 'https://deploylint.com',
			projectId: 'proj_custom_threshold',
			deployUrl: 'https://app.example.com',
			minScore: 92
		});

		expect(workflow).toContain("DEPLOYLINT_MIN_SCORE: '92'");
		expect(workflow).not.toContain("DEPLOYLINT_MIN_SCORE: '80'");
	});

	it('builds a safe project draft from workspace setup query params', () => {
		const draft = buildProjectDraftFromSearchParams(
			new URLSearchParams({
				name: '  Acme control plane  ',
				repo: 'https://github.com/acme/control-plane',
				deploy: 'https://app.acme.com/',
				minScore: '92'
			})
		);

		expect(draft).toEqual({
			name: 'Acme control plane',
			repoLabel: 'github.com/acme/control-plane',
			deployUrl: 'https://app.acme.com',
			minScore: 92
		});
	});

	it('ignores unsafe draft values instead of putting them into workflow config', () => {
		const draft = buildProjectDraftFromSearchParams(
			new URLSearchParams({
				name: 'Bad\nName',
				repo: 'javascript:alert(1)',
				deploy: 'javascript:alert(1)',
				minScore: '120'
			})
		);

		expect(draft).toEqual({
			name: 'Bad Name'
		});
	});

	it('ignores a min score without project identity fields', () => {
		expect(buildProjectDraftFromSearchParams(new URLSearchParams({ minScore: '80' }))).toEqual({});
	});

	it('applies a project draft to the workspace setup state and advisory workflow target', () => {
		const workspace = buildWorkspaceSetupState({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: true,
			projectDraft: {
				name: 'Acme control plane',
				repoLabel: 'github.com/acme/control-plane',
				deployUrl: 'https://app.acme.com',
				minScore: 92
			}
		});
		const project = workspace.projects[0];

		expect(project).toMatchObject({
			name: 'Acme control plane',
			repoLabel: 'github.com/acme/control-plane',
			deployUrl: 'https://app.acme.com',
			minScore: 92
		});

		const workflow = buildAdvisoryWorkflow({
			appUrl: 'https://deploylint.com',
			projectId: project.id,
			deployUrl: project.deployUrl,
			repoLabel: project.repoLabel,
			minScore: project.minScore
		});
		expect(workflow).toContain('DEPLOYLINT_URL: https://app.acme.com');
		expect(workflow).toContain('DEPLOYLINT_REPO_URL: github.com/acme/control-plane');
		expect(workflow).toContain("DEPLOYLINT_MIN_SCORE: '92'");
	});

	it('keeps the activation checklist centered on first CI report, not another scan', () => {
		expect(workspaceActivationSteps.map((step) => step.id)).toEqual([
			'project',
			'workflow',
			'first-report',
			'gate'
		]);
		expect(workspaceActivationSteps[2].label).toContain('first advisory report');
	});

	it('documents the handoff from advisory report to required deploy gate', () => {
		expect(workspaceGateHardeningSteps.map((step) => step.id)).toEqual([
			'advisory-report',
			'required-status',
			'gate-mode'
		]);
		expect(workspaceGateHardeningSteps[1].label).toContain('required status check');
		expect(workspaceGateHardeningSteps[1].description).toContain('branch protection');
		expect(workspaceGateHardeningSteps[2].description).toContain('workspace');
	});

	it('summarizes the deploy gate policy from project state', () => {
		const workspace = buildWorkspaceSetupState({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: false
		});
		workspace.projects[0].minScore = 92;

		const policy = buildWorkspaceGatePolicy(workspace.projects[0]);

		expect(policy).toMatchObject({
			checkName: 'deploylint',
			mode: 'advisory',
			minScore: 92,
			enforcementLabel: 'Advisory only'
		});
		expect(policy.requiredEnvVars).toEqual([
			'DEPLOYLINT_PROJECT_ID',
			'DEPLOYLINT_INGEST_TOKEN',
			'DEPLOYLINT_MODE',
			'DEPLOYLINT_MIN_SCORE'
		]);
		expect(policy.blocks).toContain('Score below 92');
		expect(policy.blocks).toContain('NO-GO deploy verdict');
		expect(policy.blocks.some((blocker) => blocker.includes('P0 blocker'))).toBe(true);
	});

	it('builds command center stats across multiple monitored projects', () => {
		const workspace = buildWorkspaceSetupState({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: false
		});
		workspace.billing.projectLimit = 5;
		workspace.metrics.activeProjects = 3;
		workspace.metrics.gatesEnabled = 1;
		workspace.metrics.reportsThisMonth = 8;
		workspace.projects = [
			{
				...workspace.projects[0],
				id: 'proj_gate_ready',
				installState: 'advisory_installed',
				minScore: 90,
				latestReport: {
					id: 'report_ready',
					score: 94,
					verdict: 'go',
					scannedAt: '2026-07-08T00:00:00.000Z',
					fixedCount: 5,
					regressedCount: 1
				}
			},
			{
				...workspace.projects[0],
				id: 'proj_below_threshold',
				installState: 'advisory_installed',
				minScore: 95,
				latestReport: {
					id: 'report_below_threshold',
					score: 94,
					verdict: 'go',
					scannedAt: '2026-07-08T00:00:00.000Z',
					fixedCount: 2,
					regressedCount: 3
				}
			},
			{
				...workspace.projects[0],
				id: 'proj_gate_enabled',
				installState: 'gate_enabled',
				gateMode: 'gate',
				latestReport: {
					id: 'report_gate',
					score: 99,
					verdict: 'go',
					scannedAt: '2026-07-08T00:00:00.000Z',
					fixedCount: 4,
					regressedCount: 0
				}
			}
		];

		expect(buildWorkspaceCommandCenterStats(workspace)).toEqual({
			projectsUsed: 3,
			projectLimit: 5,
			gatesEnabled: 1,
			reportsThisMonth: 8,
			projectsReadyForGate: 1,
			latestFixedCount: 11,
			latestRegressionCount: 4
		});
	});

	it('marks workflow install as the current next action before CI is installed', () => {
		const workspace = buildWorkspaceSetupState({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: true
		});

		const activation = buildWorkspaceActivation(workspace);

		expect(activation.progress).toEqual({ completed: 1, total: 4, percentage: 25 });
		expect(activation.nextAction).toMatchObject({
			id: 'workflow',
			label: 'Install the advisory workflow',
			ctaLabel: 'Copy workflow'
		});
		expect(activation.steps.map((step) => [step.id, step.status])).toEqual([
			['project', 'complete'],
			['workflow', 'current'],
			['first-report', 'locked'],
			['gate', 'locked']
		]);
	});

	it('does not skip workflow activation when inconsistent report data exists', () => {
		const workspace = buildWorkspaceSetupState({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: false
		});
		workspace.projects[0].latestReport = {
			id: 'report_orphaned',
			score: 97,
			verdict: 'go',
			scannedAt: '2026-07-07T00:00:00.000Z',
			fixedCount: 3,
			regressedCount: 0
		};

		const activation = buildWorkspaceActivation(workspace);

		expect(activation.progress).toEqual({ completed: 1, total: 4, percentage: 25 });
		expect(activation.steps.map((step) => [step.id, step.status])).toEqual([
			['project', 'complete'],
			['workflow', 'current'],
			['first-report', 'locked'],
			['gate', 'locked']
		]);
	});

	it('moves the next action to first report after advisory install', () => {
		const workspace = buildWorkspaceSetupState({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: false
		});
		workspace.projects[0].installState = 'advisory_installed';

		const activation = buildWorkspaceActivation(workspace);

		expect(activation.progress).toEqual({ completed: 2, total: 4, percentage: 50 });
		expect(activation.nextAction).toMatchObject({
			id: 'first-report',
			label: 'Read the first advisory report',
			ctaLabel: 'Wait for CI report'
		});
		expect(activation.steps.map((step) => [step.id, step.status])).toEqual([
			['project', 'complete'],
			['workflow', 'complete'],
			['first-report', 'current'],
			['gate', 'locked']
		]);
	});

	it('marks activation complete when the deploy gate is enabled', () => {
		const workspace = buildWorkspaceSetupState({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: false
		});
		workspace.projects[0].installState = 'gate_enabled';
		workspace.projects[0].gateMode = 'gate';
		workspace.metrics.activeProjects = 1;
		workspace.metrics.gatesEnabled = 1;
		workspace.metrics.reportsThisMonth = 7;

		const activation = buildWorkspaceActivation(workspace);

		expect(activation.progress).toEqual({ completed: 4, total: 4, percentage: 100 });
		expect(activation.nextAction).toMatchObject({
			id: 'gate',
			label: 'Deploy gate active',
			ctaLabel: 'Review reports'
		});
		expect(activation.steps.every((step) => step.status === 'complete')).toBe(true);
	});
});
