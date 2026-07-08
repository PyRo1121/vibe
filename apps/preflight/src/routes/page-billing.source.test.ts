import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');
const reviewSource = readFileSync(
	fileURLToPath(new URL('./review/+page.svelte', import.meta.url)),
	'utf8'
);
const reportSource = readFileSync(
	fileURLToPath(new URL('../lib/components/ScanReportResults.svelte', import.meta.url)),
	'utf8'
);

describe('review billing self-service source', () => {
	it('keeps Stripe billing portal actions on the review utility, not the homepage', () => {
		expect(pageSource).not.toContain("fetch('/api/billing/portal'");
		expect(pageSource).not.toContain('billingPortalLoading');
		expect(reviewSource).toContain("fetch('/api/billing/portal'");
		expect(reviewSource).toContain('billingPortalLoading');
		expect(reportSource).toContain('Manage billing');
	});

	it('uses server-provided alpha mode on the review utility instead of a static free-unlock constant', () => {
		expect(pageSource).not.toContain('data.alphaFreeUnlock');
		expect(reviewSource).toContain('data.alphaFreeUnlock');
		expect(reviewSource).not.toContain('ALPHA_FREE_UNLOCK');
	});

	it('points the primary product path at project setup before workspace handoff', () => {
		expect(pageSource).toContain('href="#project-setup"');
		expect(pageSource).toContain('id="project-setup"');
		expect(pageSource).toContain('Start workspace setup');
	});

	it('can carry a project profile into the workspace setup surface', () => {
		expect(pageSource).toContain('method="GET"');
		expect(pageSource).toContain("action={resolve('/app')}");
		expect(pageSource).toContain('name="name"');
		expect(pageSource).toContain('name="repo"');
		expect(pageSource).toContain('name="deploy"');
		expect(pageSource).toContain('name="minScore"');
		expect(pageSource).toContain('Continue to workspace setup');
	});

	it('keeps report-only UI and scan APIs out of the initial homepage bundle', () => {
		expect(pageSource).not.toContain("import('$lib/components/ScanReportResults.svelte')");
		expect(pageSource).not.toContain("fetch('/api/scan'");
		expect(pageSource).not.toContain("fetch('/api/checkout'");
		expect(pageSource).not.toContain('sessionStorage');
		expect(reviewSource).toContain("import('$lib/components/ScanReportResults.svelte')");
		expect(reviewSource).toContain('robots="noindex, follow"');
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
