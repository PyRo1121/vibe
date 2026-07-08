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
			'Find risky GitHub Actions permissions, weak action pins, missing CodeQL, quality gates, and deploy blockers before production.',
		lastmod: SITE_LASTMOD,
		changefreq: 'weekly',
		priority: '1.0'
	},
	{
		path: '/tools',
		title: 'CI hardening tools',
		description:
			'Browse Deploylint tools for workflow risk, advisory PR reports, deploy gates, and repo hygiene.',
		lastmod: SITE_LASTMOD,
		changefreq: 'weekly',
		priority: '0.95'
	},
	{
		path: '/tools/github-actions-security-checker',
		title: 'GitHub Actions Security Checker',
		description:
			'Paste workflow YAML and find risky permissions, pull_request_target usage, weak action pins, missing CodeQL, dependency review, and quality gates.',
		lastmod: SITE_LASTMOD,
		changefreq: 'weekly',
		priority: '0.95'
	},
	{
		path: '/about',
		title: 'About Deploylint',
		description:
			'Learn how Deploylint hardens CI workflows, deploy gates, and repo hygiene before production.',
		lastmod: SITE_LASTMOD,
		changefreq: 'monthly',
		priority: '0.8'
	},
	{
		path: '/checks',
		title: 'Check catalog',
		description:
			'Browse CI, repo, deploy target, security, detection, and false-positive guidance checks.',
		lastmod: SITE_LASTMOD,
		changefreq: 'weekly',
		priority: '0.9'
	},
	{
		path: '/compare',
		title: 'Comparison',
		description:
			'Compare Deploylint with manual checklists, GitHub-native controls, SAST and IaC scanners, and Lighthouse.',
		lastmod: SITE_LASTMOD,
		changefreq: 'monthly',
		priority: '0.8'
	},
	{
		path: '/developers',
		title: 'Install in GitHub Actions',
		description:
			'Install Deploylint as a non-blocking advisory PR report first, then switch to a deploy gate.',
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
		description:
			'Track Deploylint product changes across CI hardening, deploy gates, and repo checks.',
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

function absoluteSiteUrl(path: string, origin = DEFAULT_DEPLOYLINT_API): string {
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

> CI hardening tools for GitHub Actions advisory PR reports, deploy gates, repo hygiene, and deploy workflows before production.

Deploylint helps builders catch risky workflow permissions, pull_request_target hazards, weak action pins, missing CodeQL, missing quality gates, exposed repo secrets, broken deploy surfaces, and production blockers before they reach users.

The current product loop includes a GitHub Actions Security Checker, advisory PR reports, deploy gate setup, repo hygiene checks, and public deploy target audits. The product direction is CI hardening and broader builder DevOps utilities, not a generic scanner dashboard.

Public pages:
${pages}

Built for builders using GitHub Actions, Cursor, Claude Code, Cloudflare, Vercel, and similar tools who ship fast but still need production guardrails.
`;
}
