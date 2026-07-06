import { GUIDES } from '$lib/site/guides';
import { DEFAULT_DEPLOYLINT_API } from '@vibe/deploylint-shared';

export interface PublicSiteRoute {
	path: string;
	title: string;
	description: string;
	lastmod: string;
	changefreq: 'weekly' | 'monthly';
	priority: string;
}

const SITE_LASTMOD = '2026-07-06';

export const PUBLIC_SITE_ROUTES = [
	{
		path: '/',
		title: 'Deploylint',
		description:
			'Harden GitHub Actions, deploy gates, repo hygiene, and launch workflows before production.',
		lastmod: SITE_LASTMOD,
		changefreq: 'weekly',
		priority: '1.0'
	},
	{
		path: '/tools',
		title: 'Builder DevOps tools',
		description: 'Browse Deploylint tools for CI hardening, deploy gates, and repo hygiene.',
		lastmod: SITE_LASTMOD,
		changefreq: 'weekly',
		priority: '0.95'
	},
	{
		path: '/tools/github-actions-security-checker',
		title: 'GitHub Actions Security Checker',
		description:
			'Paste workflow YAML and find risky permissions, pull_request_target usage, floating action refs, and missing quality gates.',
		lastmod: SITE_LASTMOD,
		changefreq: 'weekly',
		priority: '0.95'
	},
	{
		path: '/about',
		title: 'About Deploylint',
		description:
			'Learn how Deploylint checks AI-built apps for launch blockers before public release.',
		lastmod: SITE_LASTMOD,
		changefreq: 'monthly',
		priority: '0.8'
	},
	{
		path: '/checks',
		title: 'Check catalog',
		description: 'Browse the launch, security, SEO, social preview, and AI discovery checks.',
		lastmod: SITE_LASTMOD,
		changefreq: 'weekly',
		priority: '0.9'
	},
	{
		path: '/compare',
		title: 'Comparison',
		description: 'Compare Deploylint with Lighthouse, OG debuggers, uptime checks, and audits.',
		lastmod: SITE_LASTMOD,
		changefreq: 'monthly',
		priority: '0.8'
	},
	{
		path: '/developers',
		title: 'Advisory CI report',
		description: 'Add a non-blocking Deploylint CI report first, then switch to a deploy gate.',
		lastmod: SITE_LASTMOD,
		changefreq: 'monthly',
		priority: '0.7'
	},
	...GUIDES.map((guide) => ({
		path: `/guides/${guide.slug}`,
		title: guide.navTitle,
		description: guide.description,
		lastmod: SITE_LASTMOD,
		changefreq: 'monthly' as const,
		priority: '0.7'
	})),
	{
		path: '/changelog',
		title: 'Changelog',
		description: 'Track Deploylint product changes and newly added launch-readiness checks.',
		lastmod: SITE_LASTMOD,
		changefreq: 'weekly',
		priority: '0.6'
	},
	{
		path: '/privacy',
		title: 'Privacy',
		description: 'Read the Deploylint privacy policy.',
		lastmod: SITE_LASTMOD,
		changefreq: 'monthly',
		priority: '0.3'
	},
	{
		path: '/terms',
		title: 'Terms',
		description: 'Read the Deploylint terms of service.',
		lastmod: SITE_LASTMOD,
		changefreq: 'monthly',
		priority: '0.3'
	}
] as const satisfies readonly PublicSiteRoute[];

function normalizeOrigin(origin: string): string {
	return origin.replace(/\/+$/, '');
}

export function absoluteSiteUrl(path: string, origin = DEFAULT_DEPLOYLINT_API): string {
	const base = normalizeOrigin(origin);
	return path === '/' ? `${base}/` : `${base}${path}`;
}

export function buildSitemapXml(origin = DEFAULT_DEPLOYLINT_API): string {
	const urls = PUBLIC_SITE_ROUTES.map(
		(route) => `  <url>
    <loc>${absoluteSiteUrl(route.path, origin)}</loc>
    <lastmod>${route.lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
	).join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function buildLlmsTxt(origin = DEFAULT_DEPLOYLINT_API): string {
	const pages = PUBLIC_SITE_ROUTES.map(
		(route) => `- [${route.title}](${absoluteSiteUrl(route.path, origin)}): ${route.description}`
	).join('\n');

	return `# Deploylint

> Builder DevOps tools for hardening GitHub Actions, deploy gates, repo hygiene, and launch workflows before production.

Deploylint helps builders catch risky workflow permissions, pull_request_target hazards, floating GitHub Action refs, missing quality gates, exposed repo secrets, broken launch surfaces, and deploy blockers before they reach users.

The current toolbox includes a GitHub Actions Security Checker, deploy gate setup, public URL launch scan, and public GitHub repo scan. The product direction is CI hardening and broader builder DevOps utilities, not a generic scanner dashboard.

Public pages:
${pages}

Built for builders using GitHub Actions, Cursor, Claude Code, Cloudflare, Vercel, and similar tools who ship fast but still need production guardrails.
`;
}
