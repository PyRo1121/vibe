import { describe, expect, it } from 'vitest';

import { buildAdvisoryWorkflow, buildDemoWorkspace, workspaceActivationSteps } from './workspace';

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
			deployUrl: 'https://app.example.com'
		});

		expect(workflow).toContain('name: Deploylint advisory report');
		expect(workflow).toContain('DEPLOYLINT_PROJECT_ID: proj_demo_123');
		expect(workflow).toContain('DEPLOYLINT_URL: https://app.example.com');
		expect(workflow).toContain('DEPLOYLINT_MODE: advisory');
		expect(workflow).toContain('DEPLOYLINT_API: https://deploylint.com');
		expect(workflow).toContain('node gate-remote.mjs "$DEPLOYLINT_URL"');
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
});
