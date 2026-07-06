import { analyzeCiWorkflows } from '$lib/scan/repo/readiness';
import type { RepoReadinessFinding } from '$lib/scan/repo/readiness';
import type { ScanCheck } from '$lib/scan/types';

const TOOL_FINDING_IDS = new Set([
	'ci-runs-quality-gates',
	'dependency-review-action',
	'workflow-permissions',
	'workflow-pull-request-target',
	'workflow-action-pinning'
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
	'dependency-review-action': {
		shortTitle: 'Dependency review',
		why: 'Dependency review blocks vulnerable package changes before they land in a pull request.',
		fix: 'Run GitHub dependency review on pull requests before merge.',
		snippet: `- uses: actions/dependency-review-action@v4`
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
			'Do not broaden token permissions, introduce pull_request_target for untrusted code, remove quality gates, or switch third-party actions to floating refs.'
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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
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
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4`;

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
