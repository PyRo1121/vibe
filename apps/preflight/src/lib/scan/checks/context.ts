/** Result and context shapes shared between the scan engine and the check builders. */

export interface LinkCheckResult {
	brokenCount: number;
	checkedCount: number;
	robotsOk: boolean;
	sitemapOk: boolean;
	llmsTxtOk: boolean;
	robotsText: string | null;
	/** HEAD results for a few URLs listed in sitemap.xml; null = not sampled. */
	sitemapSample?: { checked: number; broken: number } | null;
	/** Same-origin URLs parsed from sitemap.xml for supplemental crawl. */
	sitemapLocs: string[];
}

export interface OgImageProbe {
	reachable: boolean | null;
	isImage: boolean | null;
	contentType: string | null;
}

export interface ScanContext {
	redirectHops: number;
	ogImage: OgImageProbe;
	robotsText: string | null;
	/** Milliseconds to fetch homepage HTML; null/undefined = not measured. */
	responseTimeMs?: number | null;
	/** HTTP status a random missing path returned; null/undefined = probe skipped. */
	notFoundStatus?: number | null;
	/** SPF/DMARC DNS lookups; null/undefined = resolver unavailable. */
	emailAuth?: { spf: boolean; dmarc: boolean; domain: string } | null;
	/** www ↔ apex sibling probe; null/undefined = not applicable. */
	hostConsistency?: { altHost: string; resolves: boolean; sameSite: boolean } | null;
	/** Same-origin sensitive path probes. */
	exposedPaths?: import('$lib/scan/probes').ExposedPathResult;
	healthEndpoint?: import('$lib/scan/probes').HealthEndpointResult;
	debugSignals?: import('$lib/scan/probes').DebugSignals;
}
