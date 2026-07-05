import { describe, expect, it } from 'vitest';
import { PUBLIC_SITE_ROUTES, buildLlmsTxt, buildSitemapXml } from './crawler-surfaces';

describe('crawler-facing website surfaces', () => {
	it('keeps public website routes in one crawlable registry', () => {
		expect(PUBLIC_SITE_ROUTES.map((route) => route.path)).toEqual([
			'/',
			'/launch-readiness-checker',
			'/ai-app-launch-checker',
			'/vibe-code-launch-checklist',
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
		expect(xml).toContain('<loc>https://deploylint.com/launch-readiness-checker</loc>');
		expect(xml).toContain('<loc>https://deploylint.com/ai-app-launch-checker</loc>');
		expect(xml).toContain('<loc>https://deploylint.com/vibe-code-launch-checklist</loc>');
		expect(xml).toContain('<loc>https://deploylint.com/compare</loc>');
		expect(xml).not.toContain('/api/');
		expect(xml).not.toContain('/r/');
	});

	it('generates llms.txt from the same website route list', () => {
		const text = buildLlmsTxt('https://deploylint.com');

		expect(text).toContain('- Check catalog: https://deploylint.com/checks');
		expect(text).toContain(
			'- Launch readiness checker: https://deploylint.com/launch-readiness-checker'
		);
		expect(text).toContain('- AI app launch checker: https://deploylint.com/ai-app-launch-checker');
		expect(text).toContain(
			'- Vibe code launch checklist: https://deploylint.com/vibe-code-launch-checklist'
		);
		expect(text).toContain('Alpha access: all scan output is currently free');
		expect(text).not.toContain('GitHub');
	});
});
