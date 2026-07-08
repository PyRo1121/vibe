import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

describe('/checks page copy', () => {
	it('positions the catalog as readiness controls without MCP product promises', () => {
		expect(pageSource).not.toMatch(/\bGitHub\b/);
		expect(pageSource).not.toMatch(/\bMCP\b/);
		expect(pageSource).toMatch(/readiness-control catalog/i);
	});
});
