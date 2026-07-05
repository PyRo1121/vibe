import { describe, expect, it } from 'vitest';
import { SEO_LANDING_PAGES, getSeoLandingPage } from './seo-pages';

describe('SEO landing pages', () => {
	it('defines focused public search pages with unique metadata', () => {
		expect(SEO_LANDING_PAGES.map((page) => page.slug)).toEqual([
			'launch-readiness-checker',
			'ai-app-launch-checker',
			'vibe-code-launch-checklist'
		]);

		const titles = new Set(SEO_LANDING_PAGES.map((page) => page.title));
		const descriptions = new Set(SEO_LANDING_PAGES.map((page) => page.description));

		expect(titles.size).toBe(SEO_LANDING_PAGES.length);
		expect(descriptions.size).toBe(SEO_LANDING_PAGES.length);
		for (const page of SEO_LANDING_PAGES) {
			expect(page.h1.length).toBeGreaterThan(20);
			expect(page.searchIntent.length).toBeGreaterThan(40);
			expect(page.sections).toHaveLength(3);
			expect(page.faq).toHaveLength(3);
		}
	});

	it('can look up pages by slug', () => {
		expect(getSeoLandingPage('ai-app-launch-checker')?.title).toContain('AI app');
		expect(getSeoLandingPage('missing-page')).toBeNull();
	});
});
