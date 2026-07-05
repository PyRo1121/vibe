import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Plausible Worker config', () => {
	it('does not pin a Plausible personalized script URL in wrangler vars', () => {
		const wranglerConfig = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');

		expect(wranglerConfig).not.toContain('PUBLIC_PLAUSIBLE_SCRIPT');
		expect(wranglerConfig).not.toMatch(/plausible\.io\/js\/pa-[^"']+\.js/);
	});
});
