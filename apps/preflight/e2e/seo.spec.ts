import { expect, test } from '@playwright/test';

const baseUrl = 'https://deploylint.com';
const socialImage = `${baseUrl}/og.png`;

const pages = [
	{
		path: '/',
		title: 'CI hardening and builder DevOps tools - Deploylint',
		description:
			'Harden GitHub Actions, deploy gates, repo hygiene, and launch workflows before risky changes hit production. Deploylint includes CI tools plus URL and repo scans.',
		canonical: `${baseUrl}/`,
		heading: /Harden the path from pull request to production/i,
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
		path: '/about',
		title: 'About Deploylint - Deploylint',
		description:
			'Deploylint builds CI hardening, deploy gate, repo hygiene, and launch workflow tools for builders shipping with GitHub Actions and AI coding agents.',
		canonical: `${baseUrl}/about`,
		heading: /About Deploylint/i,
		jsonLdTypes: ['AboutPage', 'Organization'],
		staticPage: true
	},
	{
		path: '/tools',
		title: 'Builder DevOps tools - Deploylint',
		description:
			'Deploylint tools harden GitHub Actions, deploy gates, repo hygiene, and launch workflows before risky changes hit production.',
		canonical: `${baseUrl}/tools`,
		heading: /Harden the path from pull request to production/i,
		jsonLdTypes: ['CollectionPage'],
		staticPage: true
	},
	{
		path: '/tools/github-actions-security-checker',
		title: 'GitHub Actions security checker - Deploylint',
		description:
			'Paste GitHub Actions workflow YAML and find risky permissions, pull_request_target usage, floating action refs, and missing quality gates.',
		canonical: `${baseUrl}/tools/github-actions-security-checker`,
		heading: /Check workflow YAML before it deploys risky code/i,
		jsonLdTypes: ['SoftwareApplication']
	},
	{
		path: '/developers',
		title: 'Deploylint advisory CI report and deploy gate',
		description:
			'Add Deploylint to GitHub Actions as a non-blocking advisory report first, then switch to a blocking deploy gate when the signal is clean.',
		canonical: `${baseUrl}/developers`,
		heading: /Deploylint CI report for pull requests/i,
		jsonLdTypes: ['TechArticle', 'HowTo'],
		staticPage: true
	},
	{
		path: '/privacy',
		title: 'Privacy Policy - Deploylint',
		description:
			'Deploylint privacy policy for public URL scans, subscriptions, analytics, and data handling.',
		canonical: `${baseUrl}/privacy`,
		heading: /Privacy Policy/i,
		jsonLdTypes: ['WebPage'],
		staticPage: true
	},
	{
		path: '/terms',
		title: 'Terms of Service - Deploylint',
		description:
			'Deploylint terms for automated launch-readiness scans, paid subscriptions, acceptable use, and refund handling.',
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
	},
	{
		path: '/guides/ai-app-launch-checker',
		title: 'AI app launch checker for vibe-coded products - Deploylint',
		description:
			'Use Deploylint to check AI-built apps for launch blockers, SEO mistakes, security leaks, legal gaps, and broken social previews before sharing a URL.',
		canonical: `${baseUrl}/guides/ai-app-launch-checker`,
		heading: /AI app launch checker/i,
		jsonLdTypes: ['Article', 'FAQPage'],
		staticPage: true
	},
	{
		path: '/guides/website-launch-checklist',
		title: 'Website launch checklist for small SaaS products - Deploylint',
		description:
			'Run a practical website launch checklist for SEO, security headers, legal pages, social previews, crawler access, and conversion basics before launch day.',
		canonical: `${baseUrl}/guides/website-launch-checklist`,
		heading: /Website launch checklist/i,
		jsonLdTypes: ['Article', 'FAQPage'],
		staticPage: true
	},
	{
		path: '/guides/lighthouse-alternative',
		title: 'Deploylint vs Lighthouse for launch readiness',
		description:
			'Compare Deploylint and Lighthouse: Lighthouse measures lab performance, while Deploylint checks launch blockers, SEO visibility, social previews, and agent-ready fixes.',
		canonical: `${baseUrl}/guides/lighthouse-alternative`,
		heading: /Deploylint vs Lighthouse/i,
		jsonLdTypes: ['Article', 'FAQPage'],
		staticPage: true
	}
] as const;

async function meta(page: import('@playwright/test').Page, selector: string, attr = 'content') {
	return page.locator(selector).first().getAttribute(attr);
}

function collectJsonLdTypes(value: unknown, types = new Set<string>()): Set<string> {
	if (!value || typeof value !== 'object') return types;
	const record = value as Record<string, unknown>;
	const type = record['@type'];
	if (typeof type === 'string') types.add(type);
	if (Array.isArray(type)) {
		for (const item of type) {
			if (typeof item === 'string') types.add(item);
		}
	}

	for (const nested of Object.values(record)) {
		if (Array.isArray(nested)) {
			for (const item of nested) collectJsonLdTypes(item, types);
		} else {
			collectJsonLdTypes(nested, types);
		}
	}

	return types;
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

			const jsonLd = (
				await page.locator('script[type="application/ld+json"]').allTextContents()
			).map((body) => JSON.parse(body) as unknown);
			const jsonLdTypes = new Set(jsonLd.flatMap((entry) => [...collectJsonLdTypes(entry)]));
			for (const type of route.jsonLdTypes) {
				expect(jsonLdTypes.has(type)).toBe(true);
			}

			if (route.staticPage) {
				await expect(page.locator('script[src*="/_app/immutable/"]')).toHaveCount(0);
			}
		});
	}
});
