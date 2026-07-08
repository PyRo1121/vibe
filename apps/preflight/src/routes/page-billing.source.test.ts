import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');
const reportSource = readFileSync(
	fileURLToPath(new URL('../lib/components/ScanReportResults.svelte', import.meta.url)),
	'utf8'
);

describe('homepage billing self-service source', () => {
	it('exposes a Stripe billing portal action for paid unlocked sessions', () => {
		expect(pageSource).toContain("fetch('/api/billing/portal'");
		expect(pageSource).toContain('billingPortalLoading');
		expect(reportSource).toContain('Manage billing');
	});

	it('uses server-provided alpha mode instead of a static free-unlock constant', () => {
		expect(pageSource).toContain('data.alphaFreeUnlock');
		expect(pageSource).not.toContain('ALPHA_FREE_UNLOCK');
	});

	it('points the primary product path at project setup before workspace handoff', () => {
		expect(pageSource).toContain('href="#project-setup"');
		expect(pageSource).toContain('id="project-setup"');
		expect(pageSource).toContain('Create monitored project');
	});

	it('can carry a project profile into the workspace setup surface', () => {
		expect(pageSource).toContain('projectWorkspaceHref');
		expect(pageSource).toContain("params.set('name'");
		expect(pageSource).toContain("params.set('repo'");
		expect(pageSource).toContain("params.set('deploy'");
		expect(pageSource).toContain('Generate advisory workflow');
	});

	it('keeps report-only UI out of the initial homepage bundle', () => {
		expect(pageSource).toContain("import('$lib/components/ScanReportResults.svelte')");
		for (const component of [
			'Checklist',
			'DeepDivesSection',
			'LaunchBriefPanel',
			'ReportSummary',
			'UnlockPanel',
			'UnlockStickyBar',
			'VerdictBanner'
		]) {
			expect(pageSource).not.toContain(`import ${component}`);
		}
	});
});
