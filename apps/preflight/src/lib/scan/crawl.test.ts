import { describe, expect, it } from 'vitest';
import {
	crawlPages,
	selectCrawlTargets,
	selectSitemapCrawlTargets,
	visibleWordCount
} from './crawl';
import { LEGAL_PAGE_HTML, STUB_PAGE_HTML } from '$lib/test/fixtures/legal-html';

const base = new URL('https://app.test/');

describe('selectCrawlTargets', () => {
	it('picks one same-origin page per role', () => {
		const links = [
			'https://app.test/privacy',
			'https://app.test/privacy-policy',
			'https://app.test/terms',
			'https://app.test/pricing',
			'https://app.test/blog'
		];
		const targets = selectCrawlTargets(links, base);
		expect(targets).toEqual([
			{ role: 'privacy', url: 'https://app.test/privacy' },
			{ role: 'terms', url: 'https://app.test/terms' },
			{ role: 'pricing', url: 'https://app.test/pricing' }
		]);
	});

	it('ignores cross-origin and homepage links', () => {
		const links = ['https://other.test/privacy', 'https://app.test/'];
		expect(selectCrawlTargets(links, base)).toEqual([]);
	});

	it('does not assign the same URL to two roles', () => {
		// /legal/terms matches the terms pattern; a combined page must be claimed once
		const links = ['https://app.test/legal/privacy-and-terms'];
		const targets = selectCrawlTargets(links, base);
		expect(targets).toHaveLength(1);
		expect(targets[0].role).toBe('privacy');
	});

	it('prefers canonical paths over marketing URLs containing the keyword', () => {
		// Real case: plausible.io links /privacy-focused-web-analytics before /privacy
		const links = [
			'https://app.test/privacy-focused-web-analytics',
			'https://app.test/privacy',
			'https://app.test/terms-of-service'
		];
		const targets = selectCrawlTargets(links, base);
		expect(targets.find((t) => t.role === 'privacy')?.url).toBe('https://app.test/privacy');
		expect(targets.find((t) => t.role === 'terms')?.url).toBe('https://app.test/terms-of-service');
	});

	it('falls back to loose matches when no canonical path exists', () => {
		const links = ['https://app.test/legal/privacy-notice-2024'];
		const targets = selectCrawlTargets(links, base);
		expect(targets).toEqual([
			{ role: 'privacy', url: 'https://app.test/legal/privacy-notice-2024' }
		]);
	});
});

describe('selectSitemapCrawlTargets', () => {
	it('prefers marketing paths and skips already-claimed URLs', () => {
		const locs = [
			'https://app.test/',
			'https://app.test/privacy',
			'https://app.test/about',
			'https://app.test/contact',
			'https://app.test/deep/nested/page'
		];
		const claimed = new Set(['https://app.test/', 'https://app.test/privacy']);
		const targets = selectSitemapCrawlTargets(locs, base, claimed);
		expect(targets).toEqual([
			{ role: 'sitemap', url: 'https://app.test/about' },
			{ role: 'sitemap', url: 'https://app.test/contact' }
		]);
	});

	it('skips asset URLs and cross-origin entries', () => {
		const locs = [
			'https://app.test/logo.png',
			'https://other.test/about',
			'https://app.test/pricing'
		];
		const targets = selectSitemapCrawlTargets(locs, base, new Set());
		expect(targets).toEqual([{ role: 'sitemap', url: 'https://app.test/pricing' }]);
	});
});

describe('visibleWordCount', () => {
	it('counts words in visible text only', () => {
		expect(visibleWordCount(LEGAL_PAGE_HTML)).toBeGreaterThan(120);
		expect(visibleWordCount(STUB_PAGE_HTML)).toBeLessThan(20);
		expect(visibleWordCount('<script>var a=1;</script>')).toBe(0);
	});
});

describe('crawlPages', () => {
	it('fetches pages in parallel and tolerates failures', async () => {
		const targets = [
			{ role: 'privacy' as const, url: 'https://app.test/privacy' },
			{ role: 'terms' as const, url: 'https://app.test/terms' }
		];
		const pages = await crawlPages(targets, async (url) => {
			if (url.pathname === '/terms') throw new Error('boom');
			return { html: LEGAL_PAGE_HTML, status: 200 };
		});
		expect(pages[0]).toMatchObject({ role: 'privacy', status: 200 });
		expect(pages[0].wordCount).toBeGreaterThan(120);
		expect(pages[1]).toMatchObject({ role: 'terms', status: null, html: '', wordCount: 0 });
	});

	it('discards the body of error responses', async () => {
		const pages = await crawlPages(
			[{ role: 'privacy' as const, url: 'https://app.test/privacy' }],
			async () => ({ html: '<html>Not found</html>', status: 404 })
		);
		expect(pages[0]).toMatchObject({ status: 404, html: '', wordCount: 0 });
	});
});
