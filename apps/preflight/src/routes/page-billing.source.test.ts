import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

describe('homepage billing self-service source', () => {
	it('exposes a Stripe billing portal action for paid unlocked sessions', () => {
		expect(pageSource).toContain("fetch('/api/billing/portal'");
		expect(pageSource).toContain('Manage billing');
		expect(pageSource).toContain('billingPortalLoading');
	});

	it('uses server-provided alpha mode instead of a static free-unlock constant', () => {
		expect(pageSource).toContain('data.alphaFreeUnlock');
		expect(pageSource).not.toContain('ALPHA_FREE_UNLOCK');
	});

	it('points the primary product path at the workspace', () => {
		expect(pageSource).toContain("resolve('/app')");
		expect(pageSource).toContain('Create project');
	});

	it('can carry a project profile into the workspace setup surface', () => {
		expect(pageSource).toContain('projectWorkspaceHref');
		expect(pageSource).toContain("params.set('name'");
		expect(pageSource).toContain("params.set('repo'");
		expect(pageSource).toContain("params.set('deploy'");
		expect(pageSource).toContain('Open workspace setup');
	});
});
