import { expect, test } from '@playwright/test';

const baseUrl = 'https://deploylint.com';
const socialImage = `${baseUrl}/og.png`;

const pages = [
	{
		path: '/',
		title: 'Deploylint - Launch readiness checker for vibe-coded apps',
		description:
			'Run 90+ launch checks before you share a URL. Deploylint finds broken previews, exposed secrets, SEO blockers, legal gaps, and gives Cursor-ready fix prompts.',
		canonical: `${baseUrl}/`,
		heading: /Should you post this URL today/i,
		jsonLdTypes: ['WebApplication', 'Organization']
	},
	{
		path: '/compare',
		title: 'Deploylint vs ShipReady, WebsiteReady, PageLens, and Lighthouse',
		description:
			'Compare Deploylint with ShipReady, WebsiteReady, PageLens, and Lighthouse for launch readiness, embarrassment prevention, CI gating, and agent-ready fixes.',
		canonical: `${baseUrl}/compare`,
		heading: /How Deploylint compares/i,
		jsonLdTypes: ['WebPage'],
		staticPage: true
	},
	{
		path: '/developers',
		title: 'Deploylint CI gate for GitHub Actions, CLI, and MCP',
		description:
			'Block bad deploys with Deploylint CI gates for GitHub Actions, zero-install scripts, local CLI checks, and MCP tools for coding agents.',
		canonical: `${baseUrl}/developers`,
		heading: /Deploy gate for vibe-coded apps/i,
		jsonLdTypes: ['TechArticle', 'HowTo'],
		staticPage: true
	},
	{
		path: '/privacy',
		title: 'Privacy Policy - Deploylint',
		description:
			'Deploylint privacy policy for public URL scans, payment unlocks, analytics, and data handling.',
		canonical: `${baseUrl}/privacy`,
		heading: /Privacy Policy/i,
		jsonLdTypes: ['WebPage'],
		staticPage: true
	},
	{
		path: '/terms',
		title: 'Terms of Service - Deploylint',
		description:
			'Deploylint terms for automated launch-readiness scans, paid fix-prompt unlocks, acceptable use, and refund handling.',
		canonical: `${baseUrl}/terms`,
		heading: /Terms of Service/i,
		jsonLdTypes: ['WebPage'],
		staticPage: true
	},
	{
		path: '/changelog',
		title: 'Deploylint Changelog - Product updates and release notes',
		description:
			'Deploylint release notes for launch-readiness checks, CI gates, MCP tools, payment unlocks, and product changes.',
		canonical: `${baseUrl}/changelog`,
		heading: /Changelog/i,
		jsonLdTypes: ['WebPage'],
		staticPage: true
	}
] as const;

async function meta(page: import('@playwright/test').Page, selector: string, attr = 'content') {
	return page.locator(selector).first().getAttribute(attr);
}

test.describe('SEO metadata', () => {
	for (const route of pages) {
		test(`${route.path} exposes complete crawl and social metadata`, async ({ page }) => {
			await page.goto(route.path);

			await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
			await expect(page).toHaveTitle(route.title);
			await expect(page.locator('h1')).toHaveCount(1);

			await expect(meta(page, 'meta[name="description"]')).resolves.toBe(route.description);
			await expect(meta(page, 'link[rel="canonical"]', 'href')).resolves.toBe(route.canonical);
			await expect(meta(page, 'meta[property="og:type"]')).resolves.toBe('website');
			await expect(meta(page, 'meta[property="og:site_name"]')).resolves.toBe('Deploylint');
			await expect(meta(page, 'meta[property="og:title"]')).resolves.toBe(route.title);
			await expect(meta(page, 'meta[property="og:description"]')).resolves.toBe(route.description);
			await expect(meta(page, 'meta[property="og:url"]')).resolves.toBe(route.canonical);
			await expect(meta(page, 'meta[property="og:image"]')).resolves.toBe(socialImage);
			await expect(meta(page, 'meta[name="twitter:card"]')).resolves.toBe('summary_large_image');
			await expect(meta(page, 'meta[name="twitter:title"]')).resolves.toBe(route.title);
			await expect(meta(page, 'meta[name="twitter:description"]')).resolves.toBe(route.description);
			await expect(meta(page, 'meta[name="twitter:image"]')).resolves.toBe(socialImage);

			const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
			for (const type of route.jsonLdTypes) {
				expect(jsonLd.some((body) => body.includes(`"@type":"${type}"`))).toBe(true);
			}

			if (route.staticPage) {
				await expect(page.locator('script[src*="/_app/immutable/"]')).toHaveCount(0);
			}
		});
	}
});
