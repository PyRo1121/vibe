import { describe, expect, it } from 'vitest';

import { plausibleInitSnippet } from './plausible';

describe('plausibleInitSnippet', () => {
	it('matches Plausible personalized script init with no explicit options', () => {
		const snippet = plausibleInitSnippet();

		expect(snippet).toContain('window.plausible=window.plausible||function()');
		expect(snippet).toContain('plausible.init=plausible.init||function(i)');
		expect(snippet).toContain('plausible.init()');
		expect(snippet).not.toContain('"domain"');
		expect(snippet).not.toContain('"endpoint"');
	});
});
