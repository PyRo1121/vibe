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

		expect(pageSource).toContain('Activation command center');
		expect(pageSource).toContain('Next action');
		expect(pageSource).toContain('Install in GitHub Actions');
		expect(pageSource).toContain('Report history');
		expect(pageSource).toContain('Gate status');
		expect(pageSource).toContain('Branch protection handoff');
		expect(pageSource).toContain('required status check');
		expect(pageSource).toContain('workspaceGateHardeningSteps');
		expect(pageSource).toContain('DEPLOYLINT_MODE');
		expect(pageSource).toContain('navigator.clipboard.writeText');
		expect(pageSource).toContain('data.activation');
		expect(pageSource).toContain('data.workspace');
		expect(pageSource).not.toContain('URL to scan');
	});
});
