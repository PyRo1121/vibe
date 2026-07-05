import { describe, expect, it } from 'vitest';

import { renderChangelogHtml } from './changelog';

describe('renderChangelogHtml', () => {
	it('renders version headings and list items', () => {
		const html = renderChangelogHtml(`## [0.35.0] - 2026-07-05

### Added

- DKIM DNS probe for launch email checks
`);
		expect(html).toContain('0.35.0');
		expect(html).toContain('<li>DKIM DNS probe');
		expect(html).not.toContain('<script');
	});
});
