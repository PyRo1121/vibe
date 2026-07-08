import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const routesDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(routesDir, '..');
const appDir = join(srcDir, '..');
const repoDir = join(appDir, '..', '..');

function source(...segments: string[]) {
	return readFileSync(join(srcDir, ...segments), 'utf8');
}

function appSource(...segments: string[]) {
	return readFileSync(join(appDir, ...segments), 'utf8');
}

function repoSource(...segments: string[]) {
	return readFileSync(join(repoDir, ...segments), 'utf8');
}

describe('Deploylint CI workspace positioning', () => {
	it('points shared reports toward workspace-backed advisory workflows', () => {
		const reportPage = source('routes', 'r', '[id]', '+page.svelte');
		const proofKit = source('lib', 'components', 'ProofKitPanel.svelte');
		const reportSummary = source('lib', 'components', 'ReportSummary.svelte');

		expect(reportPage).toContain('Create workspace from this brief');
		expect(reportPage).toContain('Install advisory workflow');
		expect(reportPage).toContain('ProofKitPanel');
		expect(proofKit).toContain('Proof kit');
		expect(proofKit).toContain('Artifacts for reviewers');
		expect(proofKit).toContain('Stakeholder brief');
		expect(proofKit).toContain('README badge');
		expect(proofKit).toContain('Advisory workflow');
		expect(reportPage).not.toContain('Scan your own site free');
		expect(reportPage).not.toContain('Want fix prompts for these issues?');
		expect(reportSummary).toContain('Deploy gate decision');
		expect(reportSummary).toContain('CI adoption path');
		expect(reportSummary).toContain('Open workspace');
		expect(reportSummary).not.toContain('Deploy risk score');
		expect(reportSummary).not.toContain('Launch score');
	});

	it('makes developer install docs distinguish free gates from workspace-backed gates', () => {
		const developersPage = source('routes', 'developers', '+page.svelte');

		expect(developersPage).toContain('workspace-backed project gate');
		expect(developersPage).toContain('Recommended path');
		expect(developersPage).toContain(
			'Use this only when you need deploy evidence before a workspace'
		);
		expect(developersPage).toContain("resolve('/app#install')");
		expect(developersPage).toContain('DEPLOYLINT_PROJECT_ID');
	});

	it('sells subscriptions as monitored projects and deploy enforcement', () => {
		const checklist = source('lib', 'components', 'Checklist.svelte');
		const preflightSession = source('lib', 'client', 'preflight-session.ts');
		const unlockPanel = source('lib', 'components', 'UnlockPanel.svelte');
		const unlockComparePanel = source('lib', 'components', 'UnlockComparePanel.svelte');

		expect(unlockPanel).toContain('workspace-backed deploy gate');
		expect(unlockPanel).toContain('guided repair plans');
		expect(preflightSession).toContain('guided repair plan');
		expect(unlockComparePanel).toContain('Workspace-backed gate, history, and monitoring');
		for (const fileSource of [checklist, preflightSession, unlockPanel, unlockComparePanel]) {
			expect(fileSource).not.toContain('Cursor prompt');
			expect(fileSource).not.toContain('Cursor-ready');
			expect(fileSource).not.toContain('master paste');
			expect(fileSource).not.toContain('copy-paste prompts');
			expect(fileSource).not.toContain('fix prompts locked');
			expect(fileSource).not.toContain('with fix prompts');
		}
		expect(unlockComparePanel).not.toContain('Embarrassment brief');
		expect(unlockComparePanel).toContain('Deploy surface brief');
	});

	it('frames shared reports and unlock offers as deploy readiness, not launch posting', () => {
		const reportPage = source('routes', 'r', '[id]', '+page.svelte');
		const launchBriefPanel = source('lib', 'components', 'LaunchBriefPanel.svelte');
		const unlockPanel = source('lib', 'components', 'UnlockPanel.svelte');
		const preflightSession = source('lib', 'client', 'preflight-session.ts');

		expect(reportPage).toContain('Deploy readiness report');
		expect(reportPage).toContain('P0 gate blockers');
		expect(reportPage).toContain('Important issues before broad rollout');
		expect(reportPage).toContain('Ready for deploy gate review.');
		expect(launchBriefPanel).toContain('Before this reaches production');
		expect(launchBriefPanel).toContain('Deploy evidence to fix');
		expect(unlockPanel).toContain('Not Lighthouse - deploy readiness');
		expect(unlockPanel).toContain('proof before gate mode');
		expect(preflightSession).toContain('You are fixing deploy readiness');
		expect(preflightSession).toContain('before this reaches production');

		for (const fileSource of [reportPage, launchBriefPanel, unlockPanel, preflightSession]) {
			expect(fileSource).not.toContain('Product Hunt');
			expect(fileSource).not.toContain('post publicly');
			expect(fileSource).not.toContain('before you post');
			expect(fileSource).not.toContain('public embarrassment');
			expect(fileSource).not.toContain('launch blocker');
			expect(fileSource).not.toContain('Clear to launch');
		}
	});

	it('keeps core report and prompt surfaces aligned to deploy gates', () => {
		const checklist = source('lib', 'components', 'Checklist.svelte');
		const verdictBanner = source('lib', 'components', 'VerdictBanner.svelte');
		const unlockGuide = source('lib', 'components', 'PostUnlockGuide.svelte');
		const brief = source('lib', 'scan', 'brief.ts');
		const verdict = source('lib', 'scan', 'verdict.ts');
		const prompts = source('lib', 'scan', 'prompts.ts');

		expect(verdictBanner).toContain('Gate readiness decision');
		expect(unlockGuide).toContain('Three steps before gate mode');
		expect(checklist).toContain('Production blockers');
		expect(brief).toContain('Ready for gate mode');
		expect(verdict).toContain('Clear for deploy gate review');
		expect(prompts).toContain('You are fixing deploy readiness');

		for (const fileSource of [checklist, verdictBanner, unlockGuide, brief, verdict, prompts]) {
			expect(fileSource).not.toContain('Launch verdict');
			expect(fileSource).not.toContain('Product Hunt');
			expect(fileSource).not.toContain('Reddit');
			expect(fileSource).not.toContain('post publicly');
			expect(fileSource).not.toContain('posting publicly');
			expect(fileSource).not.toContain('before sharing');
			expect(fileSource).not.toContain('sharing publicly');
			expect(fileSource).not.toContain('before a big launch');
		}
	});

	it('keeps first-impression surfaces from reading like a one-off URL scanner', () => {
		const ogSvg = appSource('static', 'og.svg');
		const loginPage = source('routes', 'login', '+page.svelte');
		const homePage = source('routes', '+page.svelte');
		const toolsPage = source('routes', 'tools', '+page.svelte');
		const workflowToolPage = source(
			'routes',
			'tools',
			'github-actions-security-checker',
			'+page.svelte'
		);
		const reportPage = source('routes', 'r', '[id]', '+page.svelte');
		const reportSummary = source('lib', 'components', 'ReportSummary.svelte');
		const preflightSession = source('lib', 'client', 'preflight-session.ts');
		const unlockComparePanel = source('lib', 'components', 'UnlockComparePanel.svelte');

		expect(ogSvg).toContain('CI hardening before deploy');
		expect(ogSvg).toContain('Advisory PR reports | deploy gates | repo hygiene');
		expect(loginPage).toContain('Sign in to manage deploy gates');
		expect(loginPage).toMatch(/monitored\s+workspace/);
		expect(homePage).toContain('Project profile');
		expect(homePage).toContain('Create a monitored project');
		expect(homePage).toContain('GitHub repository');
		expect(homePage).toContain('Release URL');
		expect(homePage).toContain('Workspace loop');
		expect(homePage).toContain('What the workspace keeps enforcing');
		expect(homePage).toContain('Monitored projects');
		expect(homePage).toContain('Generate advisory workflow');
		expect(homePage).toContain('Run advisory review');
		expect(homePage).toContain('Preparing release-readiness evidence');
		expect(homePage).toContain('What the advisory loop checks');
		expect(toolsPage).toContain("href: '/app#project'");
		expect(toolsPage).toContain("href: '/developers'");
		expect(toolsPage).toContain('Create monitored project');
		expect(toolsPage).toContain('Add repo checks to CI');
		expect(workflowToolPage).toContain("href={resolve('/app#project')}");
		expect(reportPage).toContain('Readiness brief');
		expect(reportSummary).toContain('Copy readiness brief');
		expect(reportSummary).toContain('Project evidence reviewed');
		expect(reportSummary).toContain('Customer access readiness');
		expect(preflightSession).toContain('Add Deploylint to CI');
		expect(unlockComparePanel).toContain('Initial advisory evidence');
		expect(unlockComparePanel).toContain('Monitored CI gate');

		for (const fileSource of [
			ogSvg,
			loginPage,
			homePage,
			reportPage,
			reportSummary,
			preflightSession,
			unlockComparePanel
		]) {
			expect(fileSource).not.toContain('Should you post this URL today?');
			expect(fileSource).not.toContain('90+ launch checks');
			expect(fileSource).not.toContain('dashboard becomes the product');
			expect(fileSource).not.toContain('one-off scan session');
			expect(fileSource).not.toContain('Secondary utility');
			expect(fileSource).not.toContain('Shared report');
			expect(fileSource).not.toContain('Copy report link');
			expect(fileSource).not.toContain('Check yours free');
			expect(fileSource).not.toContain('Free scan (you have this)');
			expect(fileSource).not.toContain('One-off report (you have this)');
			expect(fileSource).not.toContain('Attach readiness evidence');
			expect(fileSource).not.toContain('deploy URL or github.com/you/repo');
			expect(fileSource).not.toContain('Revenue readiness');
		}
		expect(homePage).not.toContain('Preview readiness brief');
		expect(homePage).not.toContain('Fetching homepage');
		expect(homePage).not.toContain('Crawling privacy, terms & pricing pages');
		expect(homePage).not.toContain('Readiness evidence lanes');
		expect(toolsPage).not.toContain("href: '/'");
		expect(toolsPage).not.toContain('Build readiness report');
		expect(toolsPage).not.toContain('Check repo');
		expect(workflowToolPage).not.toContain("href={resolve('/')}");
	});

	it('makes generated advisory workflows skip cleanly when fork PR secrets are unavailable', () => {
		const homePage = source('routes', '+page.svelte');
		const developersPage = source('routes', 'developers', '+page.svelte');
		const workflowToolPage = source(
			'routes',
			'tools',
			'github-actions-security-checker',
			'+page.svelte'
		);
		const workspaceModel = source('lib', 'product', 'workspace.ts');
		const compositeAction = repoSource('.github', 'actions', 'deploylint-gate', 'action.yml');

		for (const fileSource of [homePage, developersPage, workflowToolPage, workspaceModel]) {
			expect(fileSource).toContain('if [ -z "$DEPLOYLINT_URL" ]; then');
			expect(fileSource).toContain(
				'Skipping Deploylint advisory report because DEPLOYLINT_URL is unavailable'
			);
		}
		expect(compositeAction).toContain('if [ -z "${DEPLOYLINT_URL:-}" ]; then');
		expect(compositeAction).toContain(
			'Skipping Deploylint advisory report because DEPLOYLINT_URL is unavailable'
		);
	});
});
