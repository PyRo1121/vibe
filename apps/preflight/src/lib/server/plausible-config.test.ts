import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Plausible Worker config', () => {
	it('pins the current Deploylint Plausible personalized script URL', () => {
		const wranglerConfig = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');

		expect(wranglerConfig).toContain(
			'"PUBLIC_PLAUSIBLE_SCRIPT": "https://plausible.io/js/pa-kDKT3UQlQwf5rMj8gkKwW.js"'
		);
		expect(wranglerConfig).not.toContain('pa-6HNboY8BBbu4MK_Qmeoxr');
	});
});
