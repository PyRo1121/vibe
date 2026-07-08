import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const wrangler = readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
const localWrangler = readFileSync(new URL('../../wrangler.local.jsonc', import.meta.url), 'utf8');
const envTypes = readFileSync(new URL('../cloudflare-env.d.ts', import.meta.url), 'utf8');

describe('auth wiring source', () => {
	it('binds a D1 auth database for Better Auth sessions', () => {
		expect(wrangler).toContain('"d1_databases"');
		expect(wrangler).toContain('"binding": "AUTH_DB"');
		expect(envTypes).toContain('AUTH_DB?: D1Database');
	});

	it('adds login and auth client surfaces', () => {
		expect(existsSync(`${appRoot}routes/login/+page.server.ts`)).toBe(true);
		expect(existsSync(`${appRoot}routes/login/+page.svelte`)).toBe(true);
		expect(existsSync(`${appRoot}lib/auth-client.ts`)).toBe(true);
		expect(wrangler).toContain('"/login"');
	});

	it('keeps alpha free unlock out of production Wrangler vars', () => {
		expect(wrangler).not.toContain('DEPLOYLINT_ALPHA_FREE_UNLOCK');
		expect(localWrangler).toContain('"DEPLOYLINT_ALPHA_FREE_UNLOCK": "true"');
	});
});
