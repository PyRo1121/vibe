import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pagePath = fileURLToPath(new URL('./+page.svelte', import.meta.url));
const serverPath = fileURLToPath(new URL('./+page.server.ts', import.meta.url));

function source(path: string) {
	return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

describe('/app workspace source', () => {
	it('exists as the logged-in product surface', () => {
		expect(existsSync(pagePath)).toBe(true);
		expect(existsSync(serverPath)).toBe(true);
	});

	it('presents a project workspace instead of another scanner page', () => {
		const pageSource = source(pagePath);

		expect(pageSource).toContain('Setup checklist');
		expect(pageSource).toContain('Next action');
		expect(pageSource).toContain('Install in GitHub Actions');
		expect(pageSource).toContain('Report history');
		expect(pageSource).toContain('Awaiting first CI report');
		expect(pageSource).toContain('Awaiting first run');
		expect(pageSource).toContain('Readiness trend');
		expect(pageSource).toContain('Recent CI reports');
		expect(pageSource).toContain('Open brief');
		expect(pageSource).toContain('scoreDeltaLabel');
		expect(pageSource).toContain('awaitingFirstReport');
		expect(pageSource).toContain('latestReport');
		expect(pageSource).toContain('reportHistory');
		expect(pageSource).toContain('reportContext');
		expect(pageSource).toContain('Gate status');
		expect(pageSource).toContain('Gate policy');
		expect(pageSource).toContain('data.gatePolicy');
		expect(pageSource).toContain('gateModeLabel');
		expect(pageSource).toContain('gatePromotionReady');
		expect(pageSource).toContain('gatePromotionHint');
		expect(pageSource).toContain('Enable blocking gate');
		expect(pageSource).toContain('action="?/enableGate"');
		expect(pageSource).toContain('form?.enableGateError');
		expect(pageSource).toContain('Required check');
		expect(pageSource).toContain('Score below');
		expect(pageSource).toContain('P0 blocker');
		expect(pageSource).toContain('Branch protection handoff');
		expect(pageSource).toContain('required status check');
		expect(pageSource).toContain('workspaceGateHardeningSteps');
		expect(pageSource).toContain('Billing status');
		expect(pageSource).toContain('Checkout complete');
		expect(pageSource).toContain('Checkout canceled');
		expect(pageSource).toContain('checkoutNoticeCopy');
		expect(pageSource).toContain('billingStatusLabel');
		expect(pageSource).toContain('workspace.metrics.activeProjects');
		expect(pageSource).toContain('workspace.metrics.gatesEnabled');
		expect(pageSource).toContain('workspace.metrics.reportsThisMonth');
		expect(pageSource).toContain('DEPLOYLINT_MODE');
		expect(pageSource).toContain('This project-scoped workflow writes CI reports back');
		expect(pageSource).toContain('DEPLOYLINT_PROJECT_ID');
		expect(pageSource).toContain('navigator.clipboard.writeText');
		expect(pageSource).toContain('Blocking gate workflow');
		expect(pageSource).toContain('data.activation');
		expect(pageSource).toContain('data.workspace');
		expect(pageSource).toContain('data.projectDraftApplied');
		expect(pageSource).toContain('Project draft applied');
		expect(pageSource).not.toContain('URL to scan');
		expect(pageSource).not.toContain('xl:grid-cols-4');
		expect(pageSource).not.toContain('Solo includes');
		expect(pageSource).not.toContain('Workspace setup preview');
		expect(pageSource).not.toContain('Sample state');
		expect(pageSource).not.toContain('project persistence is wired');
		expect(pageSource).not.toContain('Tighten checkout verification');
		expect(pageSource).toContain('This workspace includes');
	});
});
