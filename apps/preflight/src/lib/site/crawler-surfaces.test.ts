import { describe, expect, it } from 'vitest';
import { PUBLIC_SITE_ROUTES, buildLlmsTxt, buildSitemapXml } from './crawler-surfaces';

describe('crawler-facing website surfaces', () => {
	it('keeps public website routes in one crawlable registry', () => {
		expect(PUBLIC_SITE_ROUTES.map((route) => route.path)).toEqual([
			'/',
			'/checks',
			'/compare',
			'/developers',
			'/changelog',
			'/privacy',
			'/terms'
		]);
	});

	it('generates a sitemap that includes the check catalog', () => {
		const xml = buildSitemapXml('https://deploylint.com');

		expect(xml).toContain('<loc>https://deploylint.com/checks</loc>');
		expect(xml).toContain('<loc>https://deploylint.com/compare</loc>');
		expect(xml).not.toContain('/launch-readiness-checker');
		expect(xml).not.toContain('/ai-app-launch-checker');
		expect(xml).not.toContain('/vibe-code-launch-checklist');
		expect(xml).not.toContain('/api/');
		expect(xml).not.toContain('/r/');
	});

	it('generates llms.txt from the same website route list', () => {
		const text = buildLlmsTxt('https://deploylint.com');

		expect(text).toContain('- Check catalog: https://deploylint.com/checks');
		expect(text).not.toContain('/launch-readiness-checker');
		expect(text).not.toContain('/ai-app-launch-checker');
		expect(text).not.toContain('/vibe-code-launch-checklist');
		expect(text).toContain('Alpha access: all scan output is currently free');
		expect(text).not.toContain('GitHub');
	});

	it('keeps SEO trend targeting out of hidden keyword fields', () => {
		const text = buildLlmsTxt('https://deploylint.com');

		expect(text).not.toContain('meta keywords');
		expect(text).not.toContain('keyword stuffing');
		expect(text).not.toContain('hidden keywords');
	});
});
