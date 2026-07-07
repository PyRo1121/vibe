import { describe, expect, it } from 'vitest';

import {
	buildAdvisoryWorkflow,
	buildDemoWorkspace,
	buildWorkspaceActivation,
	workspaceActivationSteps
} from './workspace';

describe('Deploylint workspace model', () => {
	it('builds a project-shaped default workspace instead of a URL scan session', () => {
		const workspace = buildDemoWorkspace({
			appUrl: 'https://deploylint.com',
			alphaFreeUnlock: true
		});

		expect(workspace.ownerLabel).toBe('Early access workspace');
		expect(workspace.billing.mode).toBe('alpha');
		expect(workspace.projects).toHaveLength(1);
		expect(workspace.projects[0]).toMatchObject({
			name: 'Production deploy target',
			deployUrl: 'https://your-app.com',
			installState: 'not_installed',
			gateMode: 'advisory'
		});
		expect(workspace.projects[0].latestReport).toBeNull();
		expect(workspace.metrics).toMatchObject({
			activeProjects: 0,
			gatesEnabled: 0,
			reportsThisMonth: 0
		});
	});

	it('generates a project-scoped advisory workflow for the install loop', () => {
		const workflow = buildAdvisoryWorkflow({
			appUrl: 'https://deploylint.com/',
			projectId: 'proj_demo_123',
			deployUrl: 'https://app.example.com',
			minScore: 80
		});

		expect(workflow).toContain('name: Deploylint advisory report');
		expect(workflow).toContain('DEPLOYLINT_PROJECT_ID: proj_demo_123');
		expect(workflow).toContain('DEPLOYLINT_URL: https://app.example.com');
		expect(workflow).toContain('DEPLOYLINT_MODE: advisory');
		expect(workflow).toContain('DEPLOYLINT_API: https://deploylint.com');
		expect(workflow).toContain('node gate-remote.mjs "$DEPLOYLINT_URL"');
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

	it('keeps the activation checklist centered on first CI report, not another scan', () => {
		expect(workspaceActivationSteps.map((step) => step.id)).toEqual([
			'project',
			'workflow',
			'first-report',
			'gate'
		]);
		expect(workspaceActivationSteps[2].label).toContain('first advisory report');
	});

	it('marks workflow install as the current next action before CI is installed', () => {
		const workspace = buildDemoWorkspace({
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
		const workspace = buildDemoWorkspace({
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
		const workspace = buildDemoWorkspace({
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
		const workspace = buildDemoWorkspace({
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
