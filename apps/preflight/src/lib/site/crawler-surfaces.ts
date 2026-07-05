import { DEFAULT_DEPLOYLINT_API } from '@vibe/deploylint-shared';

export interface PublicSiteRoute {
	path: string;
	title: string;
	description: string;
	changefreq: 'weekly' | 'monthly';
	priority: string;
}

export const PUBLIC_SITE_ROUTES = [
	{
		path: '/',
		title: 'Scanner',
		description: 'Run a Deploylint launch-readiness scan for a live website.',
		changefreq: 'weekly',
		priority: '1.0'
	},
	{
		path: '/checks',
		title: 'Check catalog',
		description: 'Browse the launch, security, SEO, social preview, and AI discovery checks.',
		changefreq: 'weekly',
		priority: '0.9'
	},
	{
		path: '/compare',
		title: 'Comparison',
		description: 'Compare Deploylint with Lighthouse, OG debuggers, uptime checks, and audits.',
		changefreq: 'monthly',
		priority: '0.8'
	},
	{
		path: '/developers',
		title: 'CI gate',
		description: 'Read the deploy gate setup for teams that want automated launch blocking.',
		changefreq: 'monthly',
		priority: '0.7'
	},
	{
		path: '/changelog',
		title: 'Changelog',
		description: 'Track Deploylint product changes and newly added launch-readiness checks.',
		changefreq: 'weekly',
		priority: '0.6'
	},
	{
		path: '/privacy',
		title: 'Privacy',
		description: 'Read the Deploylint privacy policy.',
		changefreq: 'monthly',
		priority: '0.3'
	},
	{
		path: '/terms',
		title: 'Terms',
		description: 'Read the Deploylint terms of service.',
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
		(route) => `- ${route.title}: ${absoluteSiteUrl(route.path, origin)} - ${route.description}`
	).join('\n');

	return `# Deploylint

> Launch-readiness audit for AI-built apps: GO/NO-GO before you post a URL publicly.

Deploylint scans a live URL for launch blockers: exposed secrets in JavaScript bundles, broken social preview images, placeholder copy, missing legal pages, robots.txt blocking Google, llms.txt, security.txt, security headers, CVE exposure, and more.

Alpha access: all scan output is currently free while the product is being developed. Solo is planned at $9/mo after alpha, with higher tiers for more saved reports and monitoring.

Public pages:
${pages}

Built for builders using Cursor, Lovable, Bolt, and similar tools who ship fast and hate public surprises.
`;
}
