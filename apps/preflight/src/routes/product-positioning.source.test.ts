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
	});
});
