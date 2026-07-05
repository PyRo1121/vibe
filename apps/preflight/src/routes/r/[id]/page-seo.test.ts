import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

describe('/r/[id] SEO', () => {
	it('keeps generated reports out of search while preserving social previews', () => {
		expect(source).toContain('<meta name="robots" content="noindex, follow" />');
		expect(source).toContain('<link rel="canonical" href={permalink} />');
		expect(source).toContain('<meta property="og:url" content={permalink} />');
		expect(source).toContain(
			'<meta property="og:image:alt" content="Deploylint report score badge" />'
		);
	});
});
