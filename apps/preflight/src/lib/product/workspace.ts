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

function normalizeAppUrl(appUrl: string): string {
	return appUrl.trim().replace(/\/$/, '');
}

export function buildAdvisoryWorkflow(opts: {
	appUrl: string;
	projectId: string;
	deployUrl: string;
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
          DEPLOYLINT_MIN_SCORE: '80'
        run: |
          curl -fsSL ${appUrl}/gate-remote.mjs -o gate-remote.mjs
          node gate-remote.mjs "$DEPLOYLINT_URL"`;
}

export function buildDemoWorkspace(opts: {
	appUrl: string;
	alphaFreeUnlock: boolean;
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
		ownerLabel: opts.alphaFreeUnlock ? 'Early access workspace' : 'Deploylint workspace',
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
