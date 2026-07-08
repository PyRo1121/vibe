import { analyzeCiWorkflows } from '$lib/scan/repo/readiness';
import type { RepoReadinessFinding } from '$lib/scan/repo/readiness';
import type { ScanCheck } from '$lib/scan/types';

const TOOL_FINDING_IDS = new Set([
	'ci-runs-quality-gates',
	'dependency-review-action',
	'workflow-permissions',
	'workflow-pull-request-target',
	'workflow-action-pinning',
	'workflow-immutable-action-pins',
	'codeql-code-scanning',
	'deploy-job-dependencies',
	'deploy-job-environment'
]);

const FINDING_COPY: Record<
	string,
	{
		shortTitle: string;
		why: string;
		fix: string;
		snippet: string;
	}
> = {
	'ci-runs-quality-gates': {
		shortTitle: 'Quality gates',
		why: 'A deploy workflow should prove lint, typecheck, tests, and build before release.',
		fix: 'Run lint, typecheck, tests, and build before any deploy step.',
		snippet: `- run: npm ci
- run: npm run lint
- run: npm run check
- run: npm test
- run: npm run build`
	},
	'workflow-permissions': {
		shortTitle: 'Token permissions',
		why: 'GitHub defaults and write-all tokens increase blast radius when a workflow is compromised.',
		fix: 'Declare least-privilege permissions at workflow or job scope.',
		snippet: `permissions:
  contents: read`
	},
	'workflow-pull-request-target': {
		shortTitle: 'pull_request_target safety',
		why: 'pull_request_target can expose privileged tokens and secrets to untrusted pull request input.',
		fix: 'Avoid running untrusted PR code or shell interpolation inside pull_request_target workflows.',
		snippet: `on: pull_request
permissions:
  contents: read`
	},
	'workflow-action-pinning': {
		shortTitle: 'Action pinning',
		why: 'Floating refs like main, master, and latest can change workflow behavior without review.',
		fix: 'Pin third-party actions to a release tag or commit SHA.',
		snippet: `- uses: vendor/action@v1`
	},
	'workflow-immutable-action-pins': {
		shortTitle: 'Immutable action pins',
		why: 'Release tags can move; full commit SHAs make workflow dependencies immutable and reviewable.',
		fix: 'Pin every external action to a full 40-character commit SHA and update those pins deliberately.',
		snippet: `- uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0`
	},
	'codeql-code-scanning': {
		shortTitle: 'CodeQL scanning',
		why: 'CodeQL catches source and workflow security issues before pull requests merge.',
		fix: 'Add CodeQL init and analyze jobs, or document that GitHub default setup owns code scanning.',
		snippet: `- uses: github/codeql-action/init@1ad29ea4a422cce9a242a9fae469541dcd08addc
- uses: github/codeql-action/analyze@1ad29ea4a422cce9a242a9fae469541dcd08addc`
	},
	'dependency-review-action': {
		shortTitle: 'Dependency review',
		why: 'Dependency review blocks vulnerable package changes before they land in a pull request.',
		fix: 'Run GitHub dependency review on pull requests before merge.',
		snippet: `- uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294`
	},
	'deploy-job-dependencies': {
		shortTitle: 'Deploy dependencies',
		why: 'GitHub Actions jobs run in parallel by default, so deploy jobs can ship before checks finish unless they use needs.',
		fix: 'Make deploy or release jobs depend on verify, security, dependency-review, CodeQL, or Deploylint jobs with needs.',
		snippet: `jobs:
  verify:
    steps:
      - run: npm test
  deploy:
    needs: [verify]
    steps:
      - run: npm run deploy`
	},
	'deploy-job-environment': {
		shortTitle: 'Deploy environment',
		why: 'Production deploy jobs should use GitHub environments so approvals, branch rules, and environment secrets guard release steps.',
		fix: 'Add job-level environment: production to deploy jobs and configure the production environment with protection rules.',
		snippet: `deploy:
  needs: [verify]
  environment: production
  steps:
    - run: npm run deploy`
	}
};

export interface GithubActionsToolFinding {
	id: string;
	title: string;
	status: ScanCheck['status'];
	message: string;
	shortTitle: string;
	why: string;
	fix: string;
	snippet: string;
}

export interface GithubActionsReleasePlanStep {
	id: string;
	title: string;
	description: string;
	state: 'blocked' | 'ready' | 'next';
}

export interface GithubActionsToolResult {
	score: number;
	pass: number;
	warn: number;
	fail: number;
	verdict: 'hardened' | 'needs-work' | 'risky';
	verdictLabel: string;
	findings: GithubActionsToolFinding[];
	repairPrompt: string;
	nextAction: string;
	releasePlan: GithubActionsReleasePlanStep[];
	hardenedWorkflow: string;
}

function toolFinding(finding: RepoReadinessFinding): GithubActionsToolFinding {
	const copy = FINDING_COPY[finding.id] ?? {
		shortTitle: finding.title,
		why: 'This workflow signal affects deploy safety.',
		fix: 'Review the finding and update the workflow before relying on it for production.',
		snippet: ''
	};

	return {
		id: finding.id,
		title: finding.title,
		status: finding.status,
		message: finding.message,
		...copy
	};
}

function scoreFindings(findings: GithubActionsToolFinding[]): number {
	if (findings.length === 0) return 0;
	const weights: Record<ScanCheck['status'], number> = { pass: 1, warn: 0.5, fail: 0 };
	return Math.round(
		(findings.reduce((sum, finding) => sum + weights[finding.status], 0) / findings.length) * 100
	);
}

function verdict(score: number, fail: number): GithubActionsToolResult['verdict'] {
	if (fail > 0 || score < 60) return 'risky';
	if (score < 100) return 'needs-work';
	return 'hardened';
}

function verdictLabel(value: GithubActionsToolResult['verdict']): string {
	if (value === 'hardened') return 'Hardened';
	if (value === 'needs-work') return 'Needs work';
	return 'Risky';
}

function buildRepairPrompt(findings: GithubActionsToolFinding[]): string {
	const issues = findings.filter((finding) => finding.status !== 'pass');
	if (issues.length === 0) {
		return [
			'Review this GitHub Actions workflow and keep the current hardening posture intact.',
			'Do not broaden token permissions, introduce pull_request_target for untrusted code, remove quality gates, remove CodeQL or dependency review, or switch external actions away from full commit SHAs.'
		].join('\n');
	}

	return [
		'Fix this GitHub Actions workflow before it is used for production deploys.',
		'Preserve existing behavior, but make these hardening changes:',
		...issues.map((finding) => `- ${finding.title}: ${finding.fix}`),
		'Return the complete corrected workflow YAML and briefly explain each security-relevant change.'
	].join('\n');
}

function buildNextAction(resultVerdict: GithubActionsToolResult['verdict']): string {
	if (resultVerdict === 'hardened') {
		return 'Next, add Deploylint as a non-blocking advisory PR report before you switch any deploy gate to blocking mode.';
	}
	if (resultVerdict === 'needs-work') {
		return 'Patch the warnings, then add Deploylint advisory mode in CI so future PRs show launch-risk reports.';
	}
	return 'Fix the failed security finding before production deploys; use advisory mode first when you add Deploylint to CI.';
}

function buildReleasePlan(
	findings: GithubActionsToolFinding[],
	resultVerdict: GithubActionsToolResult['verdict']
): GithubActionsReleasePlanStep[] {
	const failedFindings = findings.filter((finding) => finding.status === 'fail');
	const warningFindings = findings.filter((finding) => finding.status === 'warn');
	const hardeningState =
		failedFindings.length > 0 ? 'blocked' : warningFindings.length > 0 ? 'next' : 'ready';
	const deployGateState = resultVerdict === 'hardened' ? 'next' : 'blocked';

	return [
		{
			id: 'fix-blockers',
			title:
				failedFindings.length > 0 ? 'Fix blocking workflow risk' : 'Blocking workflow risk clear',
			description:
				failedFindings.length > 0
					? `Address ${failedFindings.map((finding) => finding.shortTitle).join(', ')} before this workflow protects a deploy.`
					: 'No failing workflow control is blocking the advisory rollout.',
			state: failedFindings.length > 0 ? 'blocked' : 'ready'
		},
		{
			id: 'close-warnings',
			title: warningFindings.length > 0 ? 'Close hardening warnings' : 'Hardening warnings clear',
			description:
				warningFindings.length > 0
					? `Tighten ${warningFindings.map((finding) => finding.shortTitle).join(', ')} so the first advisory run is useful.`
					: 'The workflow already has least-privilege, pinned dependencies, code scanning, dependency review, and quality gates.',
			state: hardeningState
		},
		{
			id: 'install-advisory',
			title: 'Install the advisory CI report',
			description:
				'Add Deploylint in advisory mode first so pull requests collect launch-risk evidence without blocking active work.',
			state: resultVerdict === 'risky' ? 'blocked' : 'next'
		},
		{
			id: 'workspace-history',
			title: 'Attach reports to workspace history',
			description:
				'Create a monitored project so CI reports write to project history, billing context, and gate status instead of a one-off run.',
			state: resultVerdict === 'risky' ? 'blocked' : 'next'
		},
		{
			id: 'promote-gate',
			title: 'Promote clean signal to a deploy gate',
			description:
				'After a clean advisory report meets the minimum score, switch the project workflow to gate mode and make the status check required.',
			state: deployGateState
		}
	];
}

export function analyzeGithubActionsYaml(
	yaml: string,
	path = '.github/workflows/workflow.yml'
): GithubActionsToolResult {
	const findings = analyzeCiWorkflows([{ path, text: yaml }])
		.filter((finding) => TOOL_FINDING_IDS.has(finding.id))
		.map(toolFinding);
	const pass = findings.filter((finding) => finding.status === 'pass').length;
	const warn = findings.filter((finding) => finding.status === 'warn').length;
	const fail = findings.filter((finding) => finding.status === 'fail').length;
	const score = scoreFindings(findings);
	const resultVerdict = verdict(score, fail);

	return {
		score,
		pass,
		warn,
		fail,
		verdict: resultVerdict,
		verdictLabel: verdictLabel(resultVerdict),
		findings,
		repairPrompt: buildRepairPrompt(findings),
		nextAction: buildNextAction(resultVerdict),
		releasePlan: buildReleasePlan(findings, resultVerdict),
		hardenedWorkflow: HARDENED_GITHUB_ACTIONS_WORKFLOW
	};
}

export const HARDENED_GITHUB_ACTIONS_WORKFLOW = `name: CI hardening gate

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      # actions/checkout v7
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      # actions/setup-node v6
      - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run check
      - run: npm test
      - run: npm run build

  dependency-review:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      # actions/checkout v7
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      # actions/dependency-review-action v5.0.0
      - uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294

  codeql:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      # actions/checkout v7
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
      # github/codeql-action v4
      - uses: github/codeql-action/init@1ad29ea4a422cce9a242a9fae469541dcd08addc
      - uses: github/codeql-action/analyze@1ad29ea4a422cce9a242a9fae469541dcd08addc

  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    needs: [verify, codeql]
    environment: production
    steps:
      - run: npm run deploy`;

export const SAMPLE_GITHUB_ACTIONS_WORKFLOW = `name: Deploy

on: pull_request_target

permissions: write-all

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: acme/deploy@main
      - run: echo "\${{ github.event.pull_request.title }}"
      - run: npm test`;
