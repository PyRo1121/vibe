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
});
