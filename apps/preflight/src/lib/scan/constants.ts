/** Shared SEO length thresholds — keep analyze, social, and scoring aligned. */
export const SEO_LIMITS = {
	titlePass: 60,
	titlePreview: 70,
	descriptionPass: 160,
	descriptionPreview: 200,
	clarityTitleMin: 10,
	clarityDescriptionMin: 50
} as const;

export const USER_AGENT =
	'Preflight/1.0 (+https://preflight.latham.cloud; site-readiness-audit)';

export const FETCH_TIMEOUT_MS = 12_000;
export const MAX_LINK_CHECKS = 12;
/** Targeted sub-pages fetched per scan (privacy, terms, pricing). */
export const MAX_CRAWL_PAGES = 3;
/** Below this visible word count a legal page is treated as a stub. */
export const LEGAL_STUB_MIN_WORDS = 120;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_SCRIPT_FETCHES = 10;
export const MAX_SOURCEMAP_FETCHES = 5;
export const MAX_SCRIPT_BYTES = 512 * 1024;
export const MAX_REDIRECTS = 5;
/** Warn when HTML payload or script count suggests slow first paint. */
export const WEIGHT_LIMITS = {
	htmlWarnBytes: 400 * 1024,
	htmlFailBytes: 1.5 * 1024 * 1024,
	scriptWarnCount: 15,
	scriptFailCount: 35,
	blockingScriptWarn: 3
} as const;
