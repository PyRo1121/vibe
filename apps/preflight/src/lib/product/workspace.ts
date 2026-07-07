export type ProjectInstallState = 'not_installed' | 'advisory_installed' | 'gate_enabled';
export type ProjectGateMode = 'advisory' | 'gate';

export interface WorkspaceBillingState {
	mode: 'alpha' | 'paid' | 'setup';
	planLabel: string;
	projectLimit: number;
}

export interface ProjectReportSummary {
	id: string;
	score: number;
	verdict: 'go' | 'review' | 'no-go';
	scannedAt: string;
	fixedCount: number;
	regressedCount: number;
}

export interface DeploylintProject {
	id: string;
	name: string;
	deployUrl: string;
	repoLabel: string;
	workflowPath: string;
	installState: ProjectInstallState;
	gateMode: ProjectGateMode;
	minScore: number;
	latestReport: ProjectReportSummary | null;
}

export interface WorkspaceMetrics {
	activeProjects: number;
	gatesEnabled: number;
	reportsThisMonth: number;
}

export interface DeploylintWorkspace {
	id: string;
	ownerLabel: string;
	billing: WorkspaceBillingState;
	projects: DeploylintProject[];
	metrics: WorkspaceMetrics;
}

export type ActivationStepStatus = 'complete' | 'current' | 'locked';

export interface WorkspaceActivationStep {
	id: (typeof workspaceActivationSteps)[number]['id'];
	label: string;
	description: string;
	status: ActivationStepStatus;
	ctaLabel: string;
	href: string;
}

export interface WorkspaceNextAction {
	id: WorkspaceActivationStep['id'];
	label: string;
	description: string;
	ctaLabel: string;
	href: string;
}

export interface WorkspaceActivation {
	steps: WorkspaceActivationStep[];
	nextAction: WorkspaceNextAction;
	progress: {
		completed: number;
		total: number;
		percentage: number;
	};
}

export const workspaceActivationSteps = [
	{
		id: 'project',
		label: 'Create a project',
		description: 'Name the deploy target and keep billing, reports, and install state together.'
	},
	{
		id: 'workflow',
		label: 'Install the advisory workflow',
		description: 'Start non-blocking so the team can trust the signal before enforcing a gate.'
	},
	{
		id: 'first-report',
		label: 'Read the first advisory report',
		description: 'Use the first CI report as activation, not another one-off scan.'
	},
	{
		id: 'gate',
		label: 'Enable the deploy gate',
		description: 'Switch to blocking mode after the advisory report is clean.'
	}
] as const;

export const workspaceGateHardeningSteps = [
	{
		id: 'advisory-report',
		label: 'Run an advisory report',
		description: 'Open a pull request and confirm Deploylint posts a readable advisory CI summary.'
	},
	{
		id: 'required-status',
		label: 'Make Deploylint a required status check',
		description:
			'Add the Deploylint job to branch protection after the advisory report is trusted and the job name is unique.'
	},
	{
		id: 'gate-mode',
		label: 'Switch to blocking gate mode',
		description:
			'Change DEPLOYLINT_MODE from advisory to gate so risky production changes fail before merge.'
	}
] as const;

export type WorkspaceGateHardeningStep = (typeof workspaceGateHardeningSteps)[number];

const ACTIVATION_CTA: Record<
	(typeof workspaceActivationSteps)[number]['id'],
	{ ctaLabel: string; href: string }
> = {
	project: { ctaLabel: 'Review project', href: '#project' },
	workflow: { ctaLabel: 'Copy workflow', href: '#install' },
	'first-report': { ctaLabel: 'Wait for CI report', href: '#reports' },
	gate: { ctaLabel: 'Review reports', href: '#gate' }
};

function completedActivationIds(
	project: DeploylintProject | undefined
): Set<WorkspaceActivationStep['id']> {
	const completed = new Set<WorkspaceActivationStep['id']>();
	if (!project) return completed;

	const workflowComplete =
		project.installState === 'advisory_installed' || project.installState === 'gate_enabled';
	const reportComplete =
		workflowComplete && Boolean(project.latestReport || project.installState === 'gate_enabled');
	const gateComplete =
		reportComplete && project.installState === 'gate_enabled' && project.gateMode === 'gate';

	completed.add('project');
	if (workflowComplete) {
		completed.add('workflow');
	}
	if (reportComplete) {
		completed.add('first-report');
	}
	if (gateComplete) {
		completed.add('gate');
	}

	return completed;
}

export function buildWorkspaceActivation(workspace: DeploylintWorkspace): WorkspaceActivation {
	const project = workspace.projects[0];
	const completed = completedActivationIds(project);
	const current =
		workspaceActivationSteps.find((step) => !completed.has(step.id)) ??
		workspaceActivationSteps[workspaceActivationSteps.length - 1];

	const steps = workspaceActivationSteps.map((step) => {
		const cta = ACTIVATION_CTA[step.id];
		const status: ActivationStepStatus = completed.has(step.id)
			? 'complete'
			: step.id === current.id
				? 'current'
				: 'locked';

		return {
			...step,
			...cta,
			status
		};
	});

	const total = steps.length;
	const completedCount = steps.filter((step) => step.status === 'complete').length;
	const currentStep = steps.find((step) => step.id === current.id) ?? steps[steps.length - 1];
	const allComplete = completedCount === total;

	return {
		steps,
		nextAction: {
			id: currentStep.id,
			label: allComplete ? 'Deploy gate active' : currentStep.label,
			description: allComplete
				? 'Your project is installed, reporting, and ready to block risky deploys.'
				: currentStep.description,
			ctaLabel: currentStep.ctaLabel,
			href: currentStep.href
		},
		progress: {
			completed: completedCount,
			total,
			percentage: Math.round((completedCount / total) * 100)
		}
	};
}

function normalizeAppUrl(appUrl: string): string {
	return appUrl.trim().replace(/\/$/, '');
}

export function buildAdvisoryWorkflow(opts: {
	appUrl: string;
	projectId: string;
	deployUrl: string;
	minScore: number;
}): string {
	const appUrl = normalizeAppUrl(opts.appUrl);

	return `name: Deploylint advisory report

on:
  pull_request:
  workflow_dispatch:

permissions: {}

jobs:
  deploylint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Run Deploylint advisory scan
        env:
          DEPLOYLINT_PROJECT_ID: ${opts.projectId}
          DEPLOYLINT_URL: ${opts.deployUrl}
          DEPLOYLINT_API: ${appUrl}
          DEPLOYLINT_MODE: advisory
          DEPLOYLINT_MIN_SCORE: '${opts.minScore}'
        run: |
          curl -fsSL ${appUrl}/gate-remote.mjs -o gate-remote.mjs
          node gate-remote.mjs "$DEPLOYLINT_URL"`;
}

export function buildDemoWorkspace(opts: {
	appUrl: string;
	alphaFreeUnlock: boolean;
	ownerLabel?: string;
}): DeploylintWorkspace {
	const project: DeploylintProject = {
		id: 'proj_demo_123',
		name: 'Production deploy target',
		deployUrl: 'https://your-app.com',
		repoLabel: 'github.com/your-org/your-app',
		workflowPath: '.github/workflows/deploylint.yml',
		installState: 'not_installed',
		gateMode: 'advisory',
		minScore: 80,
		latestReport: null
	};

	return {
		id: 'workspace_demo',
		ownerLabel:
			opts.ownerLabel ?? (opts.alphaFreeUnlock ? 'Early access workspace' : 'Deploylint workspace'),
		billing: {
			mode: opts.alphaFreeUnlock ? 'alpha' : 'setup',
			planLabel: opts.alphaFreeUnlock ? 'Early access' : 'Solo',
			projectLimit: 1
		},
		projects: [project],
		metrics: {
			activeProjects: 0,
			gatesEnabled: 0,
			reportsThisMonth: 0
		}
	};
}
