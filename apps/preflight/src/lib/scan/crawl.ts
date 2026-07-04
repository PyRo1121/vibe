import { MAX_CRAWL_PAGES } from '$lib/scan/constants';
import { visibleText } from '$lib/scan/signals';
import { isPublicHttpUrl } from '$lib/scan/url-guard';

/**
 * Targeted sub-page crawl: privacy, terms, and pricing pages linked from the
 * homepage. Source-agnostic — pages arrive through the injected fetcher, so a
 * future repo adapter (GitHub etc.) can supply file-backed pages instead.
 */

export type PageRole = 'privacy' | 'terms' | 'pricing';

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
