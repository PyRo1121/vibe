import { describe, expect, it } from 'vitest';

import { PUBLIC_SITE_ROUTES, buildLlmsTxt, buildSitemapXml } from './crawler-surfaces';

describe('crawler-facing website surfaces', () => {
	it('keeps public website routes in one crawlable registry', () => {
		expect(PUBLIC_SITE_ROUTES.map((route) => route.path)).toEqual([
			'/',
			'/tools',
			'/tools/github-actions-security-checker',
			'/about',
			'/checks',
			'/compare',
			'/developers',
			'/guides/ai-app-launch-checker',
			'/guides/website-launch-checklist',
			'/guides/lighthouse-alternative',
			'/changelog',
			'/privacy',
			'/terms'
		]);
		expect(PUBLIC_SITE_ROUTES.every((route) => /^\d{4}-\d{2}-\d{2}$/.test(route.lastmod))).toBe(
			true
		);
	});

	it('generates a sitemap that includes the check catalog', () => {
		const xml = buildSitemapXml('https://deploylint.com');

		expect(xml).toContain('<loc>https://deploylint.com/checks</loc>');
		expect(xml).toContain('<loc>https://deploylint.com/tools</loc>');
		expect(xml).toContain(
			'<loc>https://deploylint.com/tools/github-actions-security-checker</loc>'
		);
		expect(xml).toContain('<loc>https://deploylint.com/about</loc>');
		expect(xml).toContain('<lastmod>2026-07-06</lastmod>');
		expect(xml).toContain('<loc>https://deploylint.com/compare</loc>');
		expect(xml).toContain('<loc>https://deploylint.com/guides/ai-app-launch-checker</loc>');
		expect(xml).toContain('<loc>https://deploylint.com/guides/website-launch-checklist</loc>');
		expect(xml).toContain('<loc>https://deploylint.com/guides/lighthouse-alternative</loc>');
		expect(xml).not.toContain('https://deploylint.com/launch-readiness-checker');
		expect(xml).not.toContain('https://deploylint.com/ai-app-launch-checker');
		expect(xml).not.toContain('https://deploylint.com/vibe-code-launch-checklist');
		expect(xml).not.toContain('/api/');
		expect(xml).not.toContain('/r/');
	});

	it('generates llms.txt from the same website route list', () => {
		const text = buildLlmsTxt('https://deploylint.com');

		expect(text).toContain('- [Check catalog](https://deploylint.com/checks)');
		expect(text).toContain('- [CI hardening tools](https://deploylint.com/tools)');
		expect(text).toContain(
			'- [GitHub Actions Security Checker](https://deploylint.com/tools/github-actions-security-checker)'
		);
		expect(text).toContain('- [About Deploylint](https://deploylint.com/about)');
		expect(text).toContain(
			'- [AI app launch checker](https://deploylint.com/guides/ai-app-launch-checker)'
		);
		expect(text).toContain(
			'- [Website launch checklist](https://deploylint.com/guides/website-launch-checklist)'
		);
		expect(text).toMatch(/\[[^\]]+\]\(https:\/\/deploylint\.com\/[^)]*\)/);
		expect(text).not.toContain('https://deploylint.com/launch-readiness-checker');
		expect(text).not.toContain('https://deploylint.com/ai-app-launch-checker');
		expect(text).not.toContain('https://deploylint.com/vibe-code-launch-checklist');
		expect(text).toContain('advisory PR reports');
		expect(text).toContain('CI hardening and broader builder DevOps utilities');
		expect(text).toContain('GitHub Actions');
	});

	it('keeps SEO trend targeting out of hidden keyword fields', () => {
		const text = buildLlmsTxt('https://deploylint.com');

		expect(text).not.toContain('meta keywords');
		expect(text).not.toContain('keyword stuffing');
		expect(text).not.toContain('hidden keywords');
	});
});
