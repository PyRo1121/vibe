import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const routesDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(routesDir, '..');

function source(...segments: string[]) {
	return readFileSync(join(srcDir, ...segments), 'utf8');
}

describe('Deploylint CI workspace positioning', () => {
	it('points shared reports toward workspace-backed advisory workflows', () => {
		const reportPage = source('routes', 'r', '[id]', '+page.svelte');
		const reportSummary = source('lib', 'components', 'ReportSummary.svelte');

		expect(reportPage).toContain('Create workspace from this report');
		expect(reportPage).toContain('Install advisory workflow');
		expect(reportPage).not.toContain('Scan your own site free');
		expect(reportPage).not.toContain('Want fix prompts for these issues?');
		expect(reportSummary).toContain('Deploy risk score');
		expect(reportSummary).not.toContain('Launch score');
	});

	it('makes developer install docs distinguish free gates from workspace-backed gates', () => {
		const developersPage = source('routes', 'developers', '+page.svelte');

		expect(developersPage).toContain('workspace-backed project gate');
		expect(developersPage).toContain("resolve('/app#install')");
		expect(developersPage).toContain('DEPLOYLINT_PROJECT_ID');
	});

	it('sells subscriptions as monitored projects and deploy enforcement', () => {
		const unlockPanel = source('lib', 'components', 'UnlockPanel.svelte');
		const unlockComparePanel = source('lib', 'components', 'UnlockComparePanel.svelte');

		expect(unlockPanel).toContain('workspace-backed deploy gate');
		expect(unlockComparePanel).toContain('Workspace-backed gate, history, and monitoring');
		expect(unlockPanel).not.toContain('Every fix prompt - copy into Cursor or Claude');
		expect(unlockComparePanel).not.toContain('Fix everything in one Cursor paste');
		expect(unlockComparePanel).not.toContain('Embarrassment brief');
		expect(unlockComparePanel).toContain('Deploy surface brief');
	});

	it('frames shared reports and unlock offers as deploy readiness, not launch posting', () => {
		const reportPage = source('routes', 'r', '[id]', '+page.svelte');
		const launchBriefPanel = source('lib', 'components', 'LaunchBriefPanel.svelte');
		const unlockPanel = source('lib', 'components', 'UnlockPanel.svelte');
		const preflightSession = source('lib', 'client', 'preflight-session.ts');

		expect(reportPage).toContain('Deploy readiness report');
		expect(reportPage).toContain('Must fix before gate mode');
		expect(reportPage).toContain('Ready for deploy gate review.');
		expect(launchBriefPanel).toContain('Before this reaches production');
		expect(launchBriefPanel).toContain('Public deploy surface risk');
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

		expect(verdictBanner).toContain('Deploy verdict');
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
});
