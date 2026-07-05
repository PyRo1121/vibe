import { describe, expect, it } from 'vitest';

import { GET } from './+server';

describe('/sitemap.xml', () => {
	it('serves XML with a short cache window for Search Console freshness', async () => {
		const response = await GET({} as never);

		expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
		expect(response.headers.get('Cache-Control')).toBe(
			'public, max-age=300, s-maxage=300, stale-while-revalidate=60'
		);
		expect(await response.text()).not.toContain('https://deploylint.com/launch-readiness-checker');
	});
});
