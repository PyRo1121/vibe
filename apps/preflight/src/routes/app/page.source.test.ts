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

		expect(pageSource).toContain('Workspace setup preview');
		expect(pageSource).toContain('Next action');
		expect(pageSource).toContain('Install in GitHub Actions');
		expect(pageSource).toContain('Report history');
		expect(pageSource).toContain('Preview the workspace value');
		expect(pageSource).toContain('Sample state');
		expect(pageSource).toContain('Next fix');
		expect(pageSource).toContain('Persistent score history');
		expect(pageSource).toContain('reportIsPreview');
		expect(pageSource).toContain('latestReport');
		expect(pageSource).toContain('Gate status');
		expect(pageSource).toContain('Gate policy');
		expect(pageSource).toContain('data.gatePolicy');
		expect(pageSource).toContain('Required check');
		expect(pageSource).toContain('Score below');
		expect(pageSource).toContain('P0 blocker');
		expect(pageSource).toContain('Branch protection handoff');
		expect(pageSource).toContain('required status check');
		expect(pageSource).toContain('workspaceGateHardeningSteps');
		expect(pageSource).toContain('Billing status');
		expect(pageSource).toContain('billingStatusLabel');
		expect(pageSource).toContain('workspace.metrics.activeProjects');
		expect(pageSource).toContain('workspace.metrics.gatesEnabled');
		expect(pageSource).toContain('workspace.metrics.reportsThisMonth');
		expect(pageSource).toContain('DEPLOYLINT_MODE');
		expect(pageSource).toContain('navigator.clipboard.writeText');
		expect(pageSource).toContain('data.activation');
		expect(pageSource).toContain('data.workspace');
		expect(pageSource).toContain('data.projectDraftApplied');
		expect(pageSource).toContain('Project draft applied');
		expect(pageSource).not.toContain('URL to scan');
		expect(pageSource).not.toContain('xl:grid-cols-4');
		expect(pageSource).not.toContain('Solo includes');
		expect(pageSource).toContain('This setup preview shows');
	});
});
