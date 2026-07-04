import type { ScanCheck } from '$lib/scan/types';
import type { CrawledPage } from '$lib/scan/crawl';
import { pagePath, type CheckCtx } from '$lib/scan/checks/helpers';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';

/**
 * SEO-depth checks: signals beyond the basics (title/description/canonical/OG
 * live in meta.ts). Everything here is pass/warn only — these are polish
 * issues, never launch blockers.
 */

/** Decode &amp; last so double-encoded sequences don't decode twice. */
function decodeEntities(text: string): string {
	return text
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/gi, '&');
}

function extractTitle(html: string): string | null {
	const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	if (!m?.[1]) return null;
	return decodeEntities(m[1]).trim() || null;
}

function metaContent(html: string, name: string): string | null {
	const re = new RegExp(
		`<meta\\b[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']|` +
			`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
		'i'
	);
	const m = html.match(re);
	const raw = m?.[1] ?? m?.[2];
	if (raw == null) return null;
	return decodeEntities(raw).trim() || null;
}

/** Remove blocks whose headings are not part of the document outline. */
function stripNonContent(html: string): string {
	return html.replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1\s*>/gi, '');
}

function headingLevels(html: string): number[] {
	const levels: number[] = [];
	for (const m of stripNonContent(html).matchAll(/<h([1-6])\b[^>]*>/gi)) {
		levels.push(Number(m[1]));
	}
	return levels;
}

function pushHeadingOrderCheck(checks: ScanCheck[], html: string, ctx: CheckCtx): void {
	const levels = headingLevels(html);
	if (levels.length < 2) return;

	let skip: { from: number; to: number } | null = null;
	for (let i = 1; i < levels.length; i++) {
		if (levels[i] > levels[i - 1] + 1) {
			skip = { from: levels[i - 1], to: levels[i] };
			break;
		}
	}

	checks.push(
		makeCheck(
			'heading-order',
			'seo',
			'Heading outline',
			skip ? 'warn' : 'pass',
			skip
				? `Heading levels skip (h${skip.from} → h${skip.to}) — outline is broken for screen readers and search engines`
				: `Heading levels are sequential across ${levels.length} headings`,
			fixPrompt('heading-order', ctx)
		)
	);
}

function pushDuplicateMetaCheck(
	checks: ScanCheck[],
	html: string,
	ctx: CheckCtx,
	crawledPages: CrawledPage[]
): void {
	const pages = crawledPages.filter((p) => !!p.html);
	if (pages.length === 0) return;

	const homeTitle = extractTitle(html);
	const homeDescription = metaContent(html, 'description');

	let dupePath: string | null = null;
	if (homeTitle) {
		for (const page of pages) {
			if (
				extractTitle(page.html) === homeTitle &&
				metaContent(page.html, 'description') === homeDescription
			) {
				dupePath = pagePath(page.url);
				break;
			}
		}
	}

	checks.push(
		makeCheck(
			'duplicate-meta',
			'seo',
			'Duplicate page metadata',
			dupePath ? 'warn' : 'pass',
			dupePath
				? `Pages share identical title + description (e.g. ${dupePath}) — search results can't tell them apart`
				: 'Crawled pages have distinct titles',
			fixPrompt('duplicate-meta', ctx)
		)
	);
}

const HREFLANG_CODE = /^[a-z]{2}(-[A-Za-z]{2})?$|^x-default$/i;

function extractHreflangs(html: string): string[] {
	const values: string[] = [];
	for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
		if (!/\brel=["']alternate["']/i.test(tag[0])) continue;
		const m = tag[0].match(/\bhreflang=["']([^"']*)["']/i);
		if (m) values.push(m[1].trim());
	}
	return values;
}

function pushHreflangCheck(checks: ScanCheck[], html: string, ctx: CheckCtx): void {
	const values = extractHreflangs(html);
	if (values.length === 0) return;

	const invalid = values.find((v) => !HREFLANG_CODE.test(v));
	const hasXDefault = values.some((v) => v.toLowerCase() === 'x-default');

	let status: ScanCheck['status'] = 'pass';
	let message = `${values.length} hreflang alternate(s) with valid codes`;
	if (invalid !== undefined) {
		status = 'warn';
		message = `hreflang value "${invalid}" is not a valid language code — use "en" or "en-GB" style codes`;
	} else if (values.length >= 2 && !hasXDefault) {
		status = 'warn';
		message = `${values.length} hreflang alternates but no x-default — search engines need a fallback for unmatched locales`;
	}

	checks.push(
		makeCheck(
			'hreflang',
			'seo',
			'hreflang annotations',
			status,
			message,
			fixPrompt('hreflang', ctx)
		)
	);
}

/** origin+path with the trailing slash stripped; URL parsing lowercases the host. */
function normalizedOriginPath(url: URL): string {
	return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function pushOgUrlMatchCheck(
	checks: ScanCheck[],
	html: string,
	finalUrl: URL,
	ctx: CheckCtx
): void {
	const ogUrl = metaContent(html, 'og:url');
	if (!ogUrl) return;

	let matches = false;
	try {
		matches = normalizedOriginPath(new URL(ogUrl)) === normalizedOriginPath(finalUrl);
	} catch {
		// Unparseable og:url can never match the live URL — fall through to warn.
	}

	checks.push(
		makeCheck(
			'og-url-match',
			'seo',
			'og:url consistency',
			matches ? 'pass' : 'warn',
			matches
				? 'og:url matches the live page URL'
				: `og:url points to ${ogUrl} but the page lives at ${finalUrl.href} — shares may canonicalize to the wrong URL`,
			fixPrompt('og-url-match', ctx)
		)
	);
}

function pushMetaKeywordsCheck(checks: ScanCheck[], html: string, ctx: CheckCtx): void {
	if (!/<meta\b[^>]*name=["']keywords["'][^>]*>/i.test(html)) return;
	checks.push(
		makeCheck(
			'meta-keywords',
			'seo',
			'Meta keywords',
			'warn',
			'meta keywords is obsolete (ignored by Google since 2009) — remove it; it only leaks your keyword strategy',
			fixPrompt('meta-keywords', ctx)
		)
	);
}

/** Hyphen needs surrounding spaces so hyphenated brand names don't split. */
const TITLE_SEPARATOR = /\s*[|—–·:]\s*|\s+-\s+/;

function pushTitleBrandDupeCheck(checks: ScanCheck[], html: string, ctx: CheckCtx): void {
	const title = extractTitle(html);
	if (!title) return;

	const parts = title
		.split(TITLE_SEPARATOR)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
	if (parts.length < 2) return;

	const first = parts[0].toLowerCase();
	if (!parts.every((p) => p.toLowerCase() === first)) return;

	checks.push(
		makeCheck(
			'title-brand-dupe',
			'seo',
			'Title brand duplication',
			'warn',
			`Title repeats itself around a separator ("${title}") — wasted characters in search results`,
			fixPrompt('title-brand-dupe', ctx)
		)
	);
}

export function pushSeoDepthChecks(
	checks: ScanCheck[],
	html: string,
	finalUrl: URL,
	ctx: { url: string },
	crawledPages: CrawledPage[]
): void {
	pushHeadingOrderCheck(checks, html, ctx);
	pushDuplicateMetaCheck(checks, html, ctx, crawledPages);
	pushHreflangCheck(checks, html, ctx);
	pushOgUrlMatchCheck(checks, html, finalUrl, ctx);
	pushMetaKeywordsCheck(checks, html, ctx);
	pushTitleBrandDupeCheck(checks, html, ctx);
}
