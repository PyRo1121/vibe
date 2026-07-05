import { GUIDES } from '$lib/site/guides';
import { describe, expect, it } from 'vitest';

import { load } from './+page.server';

function loadGuide(slug: string, appUrl = 'https://deploylint.com') {
	return load({
		params: { slug },
		url: new URL(`https://local.test/guides/${slug}`),
		platform: { env: { PUBLIC_APP_URL: appUrl } }
	} as Parameters<typeof load>[0]);
}

describe('/guides/[slug] load', () => {
	it('loads each published guide from the registry', () => {
		for (const guide of GUIDES) {
			expect(loadGuide(guide.slug)).toEqual({
				appUrl: 'https://deploylint.com',
				guide
			});
		}
	});

	it('returns 404 for unknown guide slugs', () => {
		expect(() => loadGuide('missing-guide')).toThrow(expect.objectContaining({ status: 404 }));
	});
});
