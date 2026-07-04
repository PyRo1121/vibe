import { MAX_CRAWL_PAGES, MAX_SITEMAP_CRAWL_PAGES } from '$lib/scan/constants';
import { visibleText } from '$lib/scan/signals';
import { isPublicHttpUrl } from '$lib/scan/url-guard';

/**
 * Targeted sub-page crawl: privacy, terms, and pricing pages linked from the
 * homepage. Source-agnostic — pages arrive through the injected fetcher, so a
 * future repo adapter (GitHub etc.) can supply file-backed pages instead.
 */

export type PageRole = 'privacy' | 'terms' | 'pricing' | 'sitemap';

export interface CrawlTarget {
	role: PageRole;
	url: string;
}

export interface CrawledPage {
	role: PageRole;
	url: string;
	/** HTTP status, or null when the fetch itself failed. */
	status: number | null;
	html: string;
	/** Words of visible text — 0 when the page could not be read. */
	wordCount: number;
}

/** Matches ScanDeps['fetchHtml'] structurally without importing the engine. */
export type PageFetcher = (url: URL) => Promise<{ html: string; status: number }>;

/**
 * `strong` matches canonical paths (/privacy, /legal/terms). `loose` is the
 * fallback so marketing URLs that merely contain the word (e.g.
 * /privacy-focused-web-analytics) never shadow the real page.
 */
const ROLE_PATTERNS: Array<{ role: PageRole; strong: RegExp; loose: RegExp }> = [
	{
		role: 'privacy',
		strong: /(^|\/)(privacy(-policy)?|datenschutz)\/?$/,
		loose: /privacy|datenschutz/
	},
	{
		role: 'terms',
		strong: /(^|\/)(terms(-of-(service|use))?|tos|conditions)\/?$/,
		loose: /\bterms\b|terms-of|\btos\b|conditions/
	},
	{
		role: 'pricing',
		strong: /(^|\/)(pricing|plans)\/?$/,
		loose: /pricing|\bplans\b|upgrade|subscribe/
	}
];

function candidatePath(link: string, base: URL): { url: URL; path: string } | null {
	let url: URL;
	try {
		url = new URL(link);
	} catch {
		return null;
	}
	if (url.origin !== base.origin) return null;
	if (!isPublicHttpUrl(url.href)) return null;
	const path = url.pathname.toLowerCase();
	if (path === '/' || path === base.pathname.toLowerCase()) return null;
	return { url, path };
}

/** Pick at most one same-origin URL per role; canonical paths beat loose matches. */
export function selectCrawlTargets(links: string[], base: URL): CrawlTarget[] {
	const targets: CrawlTarget[] = [];
	const claimed = new Set<string>();

	for (const { role, strong, loose } of ROLE_PATTERNS) {
		let match: URL | null = null;
		for (const pattern of [strong, loose]) {
			for (const link of links) {
				const candidate = candidatePath(link, base);
				if (!candidate || claimed.has(candidate.url.href)) continue;
				if (!pattern.test(candidate.path)) continue;
				match = candidate.url;
				break;
			}
			if (match) break;
		}
		if (!match) continue;

		claimed.add(match.href);
		targets.push({ role, url: match.href });
		if (targets.length >= MAX_CRAWL_PAGES) break;
	}

	return targets;
}

const PRICING_PATH = /(^|\/)(pricing|plans)\/?$/;

/**
 * When homepage links omit pricing, pick a canonical /pricing or /plans URL
 * from sitemap locs — skips URLs already claimed by the role crawl.
 */
export function selectPricingFromSitemap(
	locs: string[],
	base: URL,
	claimed: Set<string>
): CrawlTarget | null {
	for (const raw of locs) {
		try {
			const url = new URL(raw);
			if (url.origin !== base.origin) continue;
			if (!isPublicHttpUrl(url.href)) continue;
			if (claimed.has(url.href)) continue;
			if (!PRICING_PATH.test(url.pathname.toLowerCase())) continue;
			return { role: 'pricing', url: url.href };
		} catch {
			// skip malformed entries
		}
	}
	return null;
}

const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|ico|pdf|xml|json|css|js|woff2?|ttf|map)(\?|$)/i;

const PREFERRED_SITEMAP_PATHS = [
	/^\/about\/?$/i,
	/^\/contact\/?$/i,
	/^\/features\/?$/i,
	/^\/blog\/?$/i
];

function isCrawlableSitemapUrl(raw: string, base: URL): boolean {
	try {
		const url = new URL(raw);
		if (url.origin !== base.origin) return false;
		if (!isPublicHttpUrl(url.href)) return false;
		if (url.pathname === '/' || url.pathname === base.pathname) return false;
		if (ASSET_EXT.test(url.pathname)) return false;
		return true;
	} catch {
		return false;
	}
}

/**
 * Pick supplemental pages from sitemap.xml locs — shallow marketing URLs
 * not already claimed by the homepage link crawl.
 */
export function selectSitemapCrawlTargets(
	locs: string[],
	base: URL,
	claimed: Set<string>
): CrawlTarget[] {
	const candidates = locs
		.filter((url) => isCrawlableSitemapUrl(url, base) && !claimed.has(url))
		.map((url) => ({ url, path: new URL(url).pathname }));

	const targets: CrawlTarget[] = [];
	const used = new Set<string>();

	for (const pattern of PREFERRED_SITEMAP_PATHS) {
		const match = candidates.find((c) => pattern.test(c.path) && !used.has(c.url));
		if (!match) continue;
		targets.push({ role: 'sitemap', url: match.url });
		used.add(match.url);
		if (targets.length >= MAX_SITEMAP_CRAWL_PAGES) return targets;
	}

	for (const candidate of candidates) {
		if (used.has(candidate.url)) continue;
		const depth = candidate.path.split('/').filter(Boolean).length;
		if (depth > 2) continue;
		targets.push({ role: 'sitemap', url: candidate.url });
		used.add(candidate.url);
		if (targets.length >= MAX_SITEMAP_CRAWL_PAGES) break;
	}

	return targets;
}

export function visibleWordCount(html: string): number {
	const text = visibleText(html);
	if (!text) return 0;
	return text.split(/\s+/).length;
}

/** Fetch targets in parallel; a failed page becomes status null, never a throw. */
export async function crawlPages(
	targets: CrawlTarget[],
	fetchPage: PageFetcher
): Promise<CrawledPage[]> {
	return Promise.all(
		targets.map(async (target): Promise<CrawledPage> => {
			try {
				const { html, status } = await fetchPage(new URL(target.url));
				return {
					role: target.role,
					url: target.url,
					status,
					html: status >= 200 && status < 400 ? html : '',
					wordCount: status >= 200 && status < 400 ? visibleWordCount(html) : 0
				};
			} catch {
				return { role: target.role, url: target.url, status: null, html: '', wordCount: 0 };
			}
		})
	);
}
