import { describe, expect, it } from 'vitest';

import { catalogEntries } from './catalog';
import { buildCatalogGroups, catalogTitle } from './catalog-view';

describe('catalog view helpers', () => {
	it('groups catalog entries by check priority', () => {
		const groups = buildCatalogGroups(catalogEntries());

		expect(groups.map((group) => group.priority)).toContain('p0');
		expect(
			groups.find((group) => group.priority === 'p0')?.entries.map((entry) => entry.id)
		).toEqual(expect.arrayContaining(['reachable', 'https', 'privacy', 'secrets']));
	});

	it('omits empty priority groups', () => {
		const groups = buildCatalogGroups([
			{
				id: 'web-manifest',
				why: 'Manifest polish matters for mobile launches.',
				detectedBy: 'Checks for a manifest link.'
			}
		]);

		expect(groups.map((group) => group.priority)).toEqual(['p2']);
	});

	it('formats check ids as readable titles', () => {
		expect(catalogTitle('hsts-header')).toBe('HSTS header');
		expect(catalogTitle('ai-client-api')).toBe('AI client API');
		expect(catalogTitle('privacy')).toBe('Privacy');
	});
});
