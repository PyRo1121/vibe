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

	it('escapes raw HTML while preserving inline markdown links', () => {
		const html = renderChangelogHtml(`## [0.36.0] - 2026-07-06

Launch note with <script>alert("x")</script> and [docs](https://deploylint.com/developers).
`);

		expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
		expect(html).toContain(
			'<a class="text-sky-300 underline underline-offset-4 hover:text-sky-200" href="https://deploylint.com/developers">docs</a>'
		);
		expect(html).not.toContain('<script>');
	});

	it('closes lists across blank lines and ignores markdown reference definitions', () => {
		const html = renderChangelogHtml(`### Fixed

- First fix
- Second fix

[0.36.0]: https://github.com/PyRo1121/vibe/releases/tag/preflight-v0.36.0

Plain launch note.
`);

		expect(html).toContain('<ul class="mb-4 list-disc space-y-2 pl-6 text-zinc-300">');
		expect(html).toContain('<li>First fix</li>');
		expect(html).toContain('</ul>\n<p class="mb-4 text-zinc-300">Plain launch note.</p>');
		expect(html).not.toContain('[0.36.0]:');
	});
});
