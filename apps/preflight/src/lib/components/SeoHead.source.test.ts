import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./SeoHead.svelte', import.meta.url)), 'utf8');

describe('SeoHead source', () => {
	it('emits crawler and social preview metadata without meta keywords', () => {
		expect(source).toContain('<meta name="robots" content={robots} />');
		expect(source).toContain('<meta name="googlebot" content={robots} />');
		expect(source).toContain('<meta property="og:image:width" content={String(imageWidth)} />');
		expect(source).toContain('<meta property="og:image:height" content={String(imageHeight)} />');
		expect(source).not.toMatch(/name=["']keywords["']/i);
	});
});
