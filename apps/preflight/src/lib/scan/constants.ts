/** Shared SEO length thresholds — keep analyze, social, and scoring aligned. */
export const SEO_LIMITS = {
	titlePass: 60,
	titlePreview: 70,
	descriptionPass: 160,
	descriptionPreview: 200,
	clarityTitleMin: 10,
	clarityDescriptionMin: 50
} as const;

export const USER_AGENT = 'Deploylint/1.0 (+https://deploylint.com; site-readiness-audit)';

export const FETCH_TIMEOUT_MS = 12_000;
/**
 * Probe depth is sized for Cloudflare Workers Free (50 subrequests/invocation).
 * @see docs/superpowers/workflow/cloudflare-free-tier.md
 */
export const MAX_LINK_CHECKS = 6;
/** Targeted sub-pages fetched per scan (privacy, terms, pricing). */
export const MAX_CRAWL_PAGES = 2;
/** Extra marketing pages discovered via sitemap.xml (beyond link-based crawl). */
export const MAX_SITEMAP_CRAWL_PAGES = 1;
/** Max URLs parsed from sitemap.xml for crawl selection and link sampling. */
export const MAX_SITEMAP_LOCS = 20;
/** Max child sitemaps followed when parsing a sitemap index. */
export const MAX_SITEMAP_INDEX_CHILDREN = 1;
/** Below this visible word count a legal page is treated as a stub. */
export const LEGAL_STUB_MIN_WORDS = 120;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_SCRIPT_FETCHES = 5;
export const MAX_SOURCEMAP_FETCHES = 2;
export const MAX_SCRIPT_BYTES = 512 * 1024;
export const MAX_REDIRECTS = 5;
/** Same-origin sensitive path probes (Preflyt-style, read-only). */
export const MAX_EXPOSED_PATH_PROBES = 8;
export const EXPOSED_PATH_PROBE_PATHS = [
	'/.env',
	'/.git/HEAD',
	'/backup.zip',
	'/.env.bak',
	'/package.json'
] as const;
export const HEALTH_PROBE_PATHS = ['/health', '/healthz'] as const;
/** Warn when HTML payload or script count suggests slow first paint. */
export const WEIGHT_LIMITS = {
	htmlWarnBytes: 400 * 1024,
	htmlFailBytes: 1.5 * 1024 * 1024,
	scriptWarnCount: 15,
	scriptFailCount: 35,
	blockingScriptWarn: 3
} as const;
