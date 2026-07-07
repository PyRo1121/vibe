import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const layoutSource = readFileSync(
	fileURLToPath(new URL('./+layout.svelte', import.meta.url)),
	'utf8'
);

describe('layout product navigation', () => {
	it('links to the project workspace without a global alpha badge', () => {
		expect(layoutSource).toContain("resolvePath('/app')");
		expect(layoutSource).toContain('Workspace');
		expect(layoutSource).not.toContain('Alpha');
	});
});
