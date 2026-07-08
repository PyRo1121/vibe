import type { LaunchVerdict } from '$lib/scan/types';

export type ProjectInstallState = 'not_installed' | 'advisory_installed' | 'gate_enabled';
export type ProjectGateMode = 'advisory' | 'gate';

export interface WorkspaceBillingState {
	mode: 'alpha' | 'paid' | 'past_due' | 'setup';
	planLabel: string;
	projectLimit: number;
}

export interface ProjectReportSummary {
	id: string;
	score: number;
	verdict: LaunchVerdict;
	scannedAt: string;
	fixedCount: number;
	regressedCount: number;
}

export interface ProjectReportHistoryEntry extends ProjectReportSummary {
	reportId: string | null;
	finalUrl: string;
	commitSha: string | null;
	branch: string | null;
	pullRequest: string | null;
}

export interface DeploylintProject {
	id: string;
	ingestToken: string;
	name: string;
	deployUrl: string;
	repoLabel: string;
	workflowPath: string;
	installState: ProjectInstallState;
	gateMode: ProjectGateMode;
	minScore: number;
	latestReport: ProjectReportSummary | null;
	reportHistory: ProjectReportHistoryEntry[];
}

export interface ProjectDraft {
	name?: string;
	deployUrl?: string;
	repoLabel?: string;
	minScore?: number;
}

export interface WorkspaceMetrics {
	activeProjects: number;
	gatesEnabled: number;
	reportsThisMonth: number;
}

export interface DeploylintWorkspace {
	id: string;
	ownerLabel: string;
	storageStatus: 'available' | 'unavailable';
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

export interface WorkspaceGatePolicy {
	checkName: string;
	mode: ProjectGateMode;
	minScore: number;
	enforcementLabel: string;
	requiredEnvVars: string[];
	blocks: string[];
}

export interface WorkspaceCommandCenterStats {
	projectsUsed: number;
	projectLimit: number;
	gatesEnabled: number;
	reportsThisMonth: number;
	projectsReadyForGate: number;
	latestFixedCount: number;
	latestRegressionCount: number;
}

export const workspaceActivationSteps = [
	{
		id: 'project',
		label: 'Define deploy target',
		description: 'Name the deploy target and keep billing, reports, and install state together.'
	},
	{
		id: 'workflow',
		label: 'Install the advisory workflow',
		description: 'Start non-blocking so the team can trust the signal before enforcing a gate.'
	},
	{
		id: 'first-report',
		label: 'Capture first CI report',
		description:
			'Use the first CI report to start workspace history, gate policy, and regression tracking.'
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
			'Enable blocking gate mode from the workspace so risky production changes fail before merge.'
	}
] as const;

const REQUIRED_GATE_ENV_VARS = [
	'DEPLOYLINT_PROJECT_ID',
	'DEPLOYLINT_INGEST_TOKEN',
	'DEPLOYLINT_MODE',
	'DEPLOYLINT_MIN_SCORE'
] as const;

const ACTIVATION_CTA: Record<
	(typeof workspaceActivationSteps)[number]['id'],
	{ ctaLabel: string; href: string }
> = {
	project: { ctaLabel: 'Review project', href: '#project' },
	workflow: { ctaLabel: 'Copy workflow', href: '#install' },
	'first-report': { ctaLabel: 'Review report stream', href: '#reports' },
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

export function buildWorkspaceGatePolicy(project: DeploylintProject): WorkspaceGatePolicy {
	return {
		checkName: 'deploylint',
		mode: project.gateMode,
		minScore: project.minScore,
		enforcementLabel: project.gateMode === 'gate' ? 'Blocking gate' : 'Advisory only',
		requiredEnvVars: [...REQUIRED_GATE_ENV_VARS],
		blocks: [
			`Score below ${project.minScore}`,
			'NO-GO deploy verdict',
			'P0 blocker check such as exposed secrets, unsafe workflow permissions, or payment safety failure'
		]
	};
}

export function buildWorkspaceCommandCenterStats(
	workspace: DeploylintWorkspace
): WorkspaceCommandCenterStats {
	const projectsReadyForGate = workspace.projects.filter(
		(project) =>
			project.installState === 'advisory_installed' &&
			project.latestReport?.verdict === 'go' &&
			project.latestReport.score >= project.minScore
	).length;
	const latestFixedCount = workspace.projects.reduce(
		(total, project) => total + (project.latestReport?.fixedCount ?? 0),
		0
	);
	const latestRegressionCount = workspace.projects.reduce(
		(total, project) => total + (project.latestReport?.regressedCount ?? 0),
		0
	);

	return {
		projectsUsed: workspace.metrics.activeProjects,
		projectLimit: workspace.billing.projectLimit,
		gatesEnabled: workspace.metrics.gatesEnabled,
		reportsThisMonth: workspace.metrics.reportsThisMonth,
		projectsReadyForGate,
		latestFixedCount,
		latestRegressionCount
	};
}

function normalizeAppUrl(appUrl: string): string {
	return appUrl.trim().replace(/\/$/, '');
}

function cleanSingleLine(value: string, maxLength: number): string {
	return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeDeployUrl(value: string): string | undefined {
	const raw = cleanSingleLine(value, 200);
	if (!raw) return undefined;
	try {
		const parsed = new URL(raw);
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
		if (!parsed.hostname) return undefined;
		return parsed.toString().replace(/\/$/, '');
	} catch {
		return undefined;
	}
}

function normalizeRepoLabel(value: string): string | undefined {
	const raw = cleanSingleLine(value, 160);
	if (!raw) return undefined;

	const sshMatch = /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(raw);
	if (sshMatch) return `github.com/${sshMatch[1]}/${sshMatch[2]}`;

	const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
	try {
		const parsed = new URL(candidate);
		if (parsed.hostname.toLowerCase() !== 'github.com') return undefined;
		const [owner, repo] = parsed.pathname.split('/').filter(Boolean);
		if (!owner || !repo) return undefined;
		return `github.com/${owner}/${repo.replace(/\.git$/i, '')}`;
	} catch {
		return undefined;
	}
}

function normalizeMinScore(value: string | null): number | undefined {
	if (!value) return undefined;
	const score = Number.parseInt(value, 10);
	if (!Number.isInteger(score) || score < 1 || score > 100) return undefined;
	return score;
}

export function buildProjectDraftFromSearchParams(params: URLSearchParams): ProjectDraft {
	const name = cleanSingleLine(params.get('name') ?? '', 80);
	const repoLabel = normalizeRepoLabel(params.get('repo') ?? '');
	const deployUrl = normalizeDeployUrl(params.get('deploy') ?? '');
	const minScore = normalizeMinScore(params.get('minScore'));
	const hasProjectIdentity = Boolean(name || repoLabel || deployUrl);

	return {
		...(name ? { name } : {}),
		...(repoLabel ? { repoLabel } : {}),
		...(deployUrl ? { deployUrl } : {}),
		...(minScore && hasProjectIdentity ? { minScore } : {})
	};
}

export function buildAdvisoryWorkflow(opts: {
	appUrl: string;
	projectId: string;
	deployUrl: string;
	repoLabel?: string;
	mode?: ProjectGateMode;
	minScore: number;
	recurring?: boolean;
}): string {
	const appUrl = normalizeAppUrl(opts.appUrl);
	const mode = opts.mode ?? 'advisory';
	const repoEnvLine = opts.repoLabel ? `          DEPLOYLINT_REPO_URL: ${opts.repoLabel}\n` : '';
	const scheduleTrigger = opts.recurring ? `  schedule:\n    - cron: '17 9 * * 1'\n` : '';

	return `name: Deploylint readiness report

on:
  pull_request:
  workflow_dispatch:
${scheduleTrigger}

permissions:
  contents: read
  pull-requests: write

jobs:
  deploylint:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Run Deploylint readiness report
        env:
          DEPLOYLINT_PROJECT_ID: ${opts.projectId}
          DEPLOYLINT_INGEST_TOKEN: \${{ secrets.DEPLOYLINT_INGEST_TOKEN }}
          DEPLOYLINT_URL: ${opts.deployUrl}
${repoEnvLine}          DEPLOYLINT_API: ${appUrl}
          DEPLOYLINT_MODE: ${mode}
          DEPLOYLINT_MIN_SCORE: '${opts.minScore}'
          GITHUB_TOKEN: \${{ github.token }}
        run: |
          if [ -z "$DEPLOYLINT_URL" ]; then
            echo "Skipping Deploylint readiness report because DEPLOYLINT_URL is unavailable (forked pull request secrets are not exposed)."
            exit 0
          fi
          if [ -z "$DEPLOYLINT_INGEST_TOKEN" ]; then
            if [ "$DEPLOYLINT_MODE" = "gate" ]; then
              echo "DEPLOYLINT_INGEST_TOKEN is required for Deploylint gate mode. Add it as a GitHub Actions secret before enabling blocking." >&2
              exit 2
            fi
            echo "Continuing without Deploylint workspace history because DEPLOYLINT_INGEST_TOKEN is unavailable (add it as a GitHub Actions secret)."
          fi
          curl -fsSL ${appUrl}/gate-remote.mjs -o gate-remote.mjs
          node gate-remote.mjs "$DEPLOYLINT_URL"`;
}

export function buildWorkspaceSetupState(opts: {
	appUrl: string;
	alphaFreeUnlock: boolean;
	ownerLabel?: string;
	projectDraft?: ProjectDraft;
}): DeploylintWorkspace {
	const draft = opts.projectDraft ?? {};
	const project: DeploylintProject = {
		id: 'proj_demo_123',
		ingestToken: 'dlint_demo_ingest_token',
		name: draft.name ?? 'First deploy target',
		deployUrl: draft.deployUrl ?? 'https://your-app.com',
		repoLabel: draft.repoLabel ?? 'github.com/your-org/your-app',
		workflowPath: '.github/workflows/deploylint.yml',
		installState: 'not_installed',
		gateMode: 'advisory',
		minScore: draft.minScore ?? 80,
		latestReport: null,
		reportHistory: []
	};

	return {
		id: 'workspace_demo',
		ownerLabel:
			opts.ownerLabel ?? (opts.alphaFreeUnlock ? 'Early access workspace' : 'Deploylint workspace'),
		storageStatus: 'available',
		billing: {
			mode: opts.alphaFreeUnlock ? 'alpha' : 'setup',
			planLabel: opts.alphaFreeUnlock ? 'Early access' : 'Solo',
			projectLimit: 1
		},
		projects: [project],
		metrics: {
			activeProjects: 1,
			gatesEnabled: 0,
			reportsThisMonth: 0
		}
	};
}
