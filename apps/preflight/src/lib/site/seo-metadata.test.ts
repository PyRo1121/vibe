import { describe, expect, it } from 'vitest';

import {
	DEPLOYLINT_SEO,
	buildDeploylintJsonLd,
	buildPageJsonLd,
	buildSeoTitle
} from './seo-metadata';

describe('Deploylint SEO metadata', () => {
	it('keeps search-facing metadata honest and keyword-stuffing-free', () => {
		expect(DEPLOYLINT_SEO.robots).toBe(
			'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
		);
		expect(DEPLOYLINT_SEO.defaultImage.width).toBe(1200);
		expect(DEPLOYLINT_SEO.defaultImage.height).toBe(630);
		expect(DEPLOYLINT_SEO.locale).toBe('en_US');
		expect('metaKeywords' in DEPLOYLINT_SEO).toBe(false);
	});

	it('builds concise titles without duplicating the brand', () => {
		expect(buildSeoTitle('Launch readiness checker')).toBe('Launch readiness checker - Deploylint');
		expect(buildSeoTitle('Deploylint')).toBe('Deploylint');
		expect(buildSeoTitle('Deploylint check catalog')).toBe('Deploylint check catalog');
	});

	it('builds a reusable schema graph for the root product', () => {
		const graph = buildDeploylintJsonLd({
			base: 'https://deploylint.com',
			description: 'Scan a live website before launch.',
			price: '9.00'
		});

		expect(graph).toHaveLength(3);
		expect(graph.map((entry) => entry['@type'])).toEqual([
			'Organization',
			'WebSite',
			['WebApplication', 'SoftwareApplication']
		]);
		expect(graph[1]).toMatchObject({
			name: 'Deploylint',
			url: 'https://deploylint.com/',
			inLanguage: 'en-US'
		});
		expect(graph[2]).toMatchObject({
			applicationCategory: 'DeveloperApplication',
			operatingSystem: 'Web',
			isAccessibleForFree: true,
			featureList: expect.arrayContaining([
				'SEO blocker detection',
				'GitHub repository scanning',
				'CI deploy gate'
			]),
			offers: {
				'@type': 'Offer',
				price: '9.00',
				priceCurrency: 'USD',
				availability: 'https://schema.org/InStock'
			}
		});
	});

	it('builds page schema linked back to the website identity', () => {
		expect(
			buildPageJsonLd({
				base: 'https://deploylint.com/',
				canonical: 'https://deploylint.com/checks',
				title: 'Deploylint check catalog',
				description: 'Browse checks.'
			})
		).toMatchObject({
			'@type': 'WebPage',
			isPartOf: { '@id': 'https://deploylint.com/#website' },
			publisher: { '@id': 'https://deploylint.com/#organization' }
		});
	});
});
