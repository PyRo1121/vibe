import { describe, expect, it } from 'vitest';

import { hasPlausibleHtmlSnippet } from '../../../scripts/smoke-assertions.mjs';

describe('hasPlausibleHtmlSnippet', () => {
	it('accepts the Deploylint personalized Plausible script', () => {
		const html = `
			<meta name="plausible-domain" content="deploylint.com" />
			<script async src="https://plausible.io/js/pa-kDKT3UQlQwf5rMj8gkKwW.js"></script>
			<script>window.plausible=window.plausible||function(){},plausible.init()</script>
		`;

		expect(hasPlausibleHtmlSnippet(html, 'deploylint.com')).toBe(true);
	});

	it('accepts the first-party proxy script', () => {
		const html = `
			<meta name="plausible-domain" content="deploylint.com" />
			<script async src="/s/script.js"></script>
			<script>window.plausible=window.plausible||function(){},plausible.init()</script>
		`;

		expect(hasPlausibleHtmlSnippet(html, 'deploylint.com')).toBe(true);
	});

	it('requires the deployed host and init stub', () => {
		expect(
			hasPlausibleHtmlSnippet(
				'<script async src="https://plausible.io/js/pa-kDKT3UQlQwf5rMj8gkKwW.js"></script>',
				'deploylint.com'
			)
		).toBe(false);
	});
});
