import { describe, expect, it } from 'vitest';

import { load } from './+page.server';

function loadLegacySlug(slug: string, appUrl = 'https://deploylint.com/') {
	return load({
		params: { slug },
		url: new URL(`https://local.test/${slug}`),
		platform: { env: { PUBLIC_APP_URL: appUrl } }
	} as Parameters<typeof load>[0]);
}

describe('/[slug] SEO legacy redirects', () => {
	it('redirects old keyword URLs to canonical guide pages', () => {
		expect(() => loadLegacySlug('ai-app-launch-checker')).toThrow(
			expect.objectContaining({
				status: 301,
				location: 'https://deploylint.com/guides/ai-app-launch-checker'
			})
		);
	});

	it('returns 404 for unrelated top-level slugs', () => {
		expect(() => loadLegacySlug('not-a-real-page')).toThrow(
			expect.objectContaining({ status: 404 })
		);
	});
});
