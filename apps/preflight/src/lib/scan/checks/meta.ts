import type { ScanCheck } from '$lib/scan/types';
import type { CrawledPage } from '$lib/scan/crawl';
import type { PageMeta } from '$lib/scan/parse';
import { LEGAL_STUB_MIN_WORDS, SEO_LIMITS } from '$lib/scan/constants';
import { lengthStatus, pagePath, tierFromCount, type CheckCtx } from '$lib/scan/checks/helpers';
import { fixPrompt } from '$lib/scan/prompts';
import { clarityScore, makeCheck } from '$lib/scan/score';
import { hasUtf8Charset } from '$lib/scan/parse';

const LEGAL_CHECKS = [
	{
		id: 'privacy',
		title: 'Privacy policy link',
		key: 'privacy' as const,
		missingStatus: 'fail' as const,
		foundMessage: 'Privacy link detected',
		missingMessage: 'No privacy policy link found'
	},
	{
		id: 'terms',
		title: 'Terms of service link',
		key: 'terms' as const,
		missingStatus: 'warn' as const,
		foundMessage: 'Terms link detected',
		missingMessage: 'No terms of service link found'
	},
	{
		id: 'contact',
		title: 'Contact / support link',
		key: 'contact' as const,
		missingStatus: 'warn' as const,
		foundMessage: 'Contact or support link found',
		missingMessage: 'No obvious contact path'
	}
] as const;

/**
 * Legal check with content verification when the linked page was crawled.
 * Without a crawled page this reproduces the original link-only behavior.
 */
function legalCheck(
	def: (typeof LEGAL_CHECKS)[number],
	linkFound: boolean,
	page: CrawledPage | undefined,
	ctx: CheckCtx
): ScanCheck {
	if (!linkFound) {
		return makeCheck(
			def.id,
			'legal',
			def.title,
			def.missingStatus,
			def.missingMessage,
			fixPrompt(def.id, ctx)
		);
	}
	if (!page) {
		return makeCheck(def.id, 'legal', def.title, 'pass', def.foundMessage, fixPrompt(def.id, ctx));
	}

	const path = pagePath(page.url);
	if (page.status === 404 || page.status === 410) {
		const message = `Link points to a missing page — HTTP ${page.status} at ${path}`;
		return makeCheck(
			def.id,
			'legal',
			def.title,
			'fail',
			message,
			fixPrompt(def.id, { ...ctx, message })
		);
	}
	if (page.status === null || page.status >= 400) {
		const message = `Found ${path} but could not verify it${page.status ? ` (HTTP ${page.status})` : ''}`;
		return makeCheck(
			def.id,
			'legal',
			def.title,
			'warn',
			message,
			fixPrompt(def.id, { ...ctx, message })
		);
	}
	if (page.wordCount < LEGAL_STUB_MIN_WORDS) {
		const message = `${path} looks like a stub — only ${page.wordCount} words of visible text`;
		return makeCheck(
			def.id,
			'legal',
			def.title,
			'warn',
			message,
			fixPrompt(def.id, { ...ctx, message })
		);
	}
	return makeCheck(
		def.id,
		'legal',
		def.title,
		'pass',
		`Verified ${path} — ${page.wordCount} words of real content`,
		fixPrompt(def.id, ctx)
	);
}

export function pushMetaChecks(
	checks: ScanCheck[],
	html: string,
	meta: PageMeta,
	ctx: CheckCtx,
	crawledPages: CrawledPage[]
): void {
	checks.push(
		makeCheck(
			'title',
			'seo',
			'Page title',
			meta.resolvedTitle ? lengthStatus(meta.resolvedTitle.length, SEO_LIMITS.titlePass) : 'fail',
			meta.resolvedTitle ? `"${meta.resolvedTitle.slice(0, 80)}"` : 'Missing <title> tag',
			fixPrompt('title', ctx)
		),
		makeCheck(
			'description',
			'seo',
			'Meta description',
			meta.description ? lengthStatus(meta.description.length, SEO_LIMITS.descriptionPass) : 'fail',
			meta.description ? `${meta.description.slice(0, 120)}…` : 'Missing meta description',
			fixPrompt('description', ctx)
		)
	);

	const ogOk = meta.ogTitle && meta.ogDescription && meta.ogImage;
	checks.push(
		makeCheck(
			'open-graph',
			'seo',
			'Open Graph tags',
			ogOk ? 'pass' : meta.ogTitle || meta.ogDescription ? 'warn' : 'fail',
			ogOk
				? 'og:title, og:description, og:image present'
				: 'Missing or incomplete OG tags for social sharing',
			fixPrompt('open-graph', ctx)
		),
		makeCheck(
			'favicon',
			'seo',
			'Favicon',
			meta.favicon ? 'pass' : 'warn',
			meta.favicon ? 'Favicon link found' : 'No favicon detected',
			fixPrompt('favicon', ctx)
		),
		makeCheck(
			'apple-touch-icon',
			'mobile',
			'Apple touch icon',
			meta.appleTouchIcon ? 'pass' : 'warn',
			meta.appleTouchIcon
				? 'apple-touch-icon link found'
				: 'No apple-touch-icon — iOS home-screen saves show a screenshot instead of your logo',
			fixPrompt('apple-touch-icon', ctx)
		),
		makeCheck(
			'viewport',
			'mobile',
			'Mobile viewport',
			meta.viewport ? 'pass' : 'fail',
			meta.viewport
				? 'viewport meta tag found'
				: 'Missing viewport meta — layout may break on phones',
			fixPrompt('viewport', ctx)
		),
		makeCheck(
			'lang',
			'a11y',
			'Document language',
			meta.lang ? 'pass' : 'warn',
			meta.lang ? `lang="${meta.lang}"` : 'Missing html lang attribute',
			fixPrompt('lang', ctx)
		),
		makeCheck(
			'charset-meta',
			'seo',
			'UTF-8 charset',
			hasUtf8Charset(html) ? 'pass' : 'warn',
			hasUtf8Charset(html)
				? 'UTF-8 charset declared'
				: 'No <meta charset="utf-8"> — mojibake risk on some browsers',
			fixPrompt('charset-meta', ctx)
		),
		makeCheck(
			'h1',
			'seo',
			'Primary heading',
			meta.h1Count === 1 ? 'pass' : 'warn',
			meta.h1Count === 1
				? 'Exactly one H1 found'
				: meta.h1Count === 0
					? 'No H1 — landing clarity may suffer'
					: `${meta.h1Count} H1s found — search engines and screen readers expect one`,
			fixPrompt('h1', ctx)
		)
	);

	const clarity = clarityScore(meta.title, meta.description, meta.h1);
	checks.push(
		makeCheck(
			'clarity',
			'launch',
			'Landing page clarity',
			clarity,
			clarity === 'pass'
				? 'Title, description, and H1 look reasonable'
				: 'Improve headline + meta for clearer positioning',
			fixPrompt('clarity', ctx)
		)
	);

	for (const def of LEGAL_CHECKS) {
		const found = meta.legal[def.key];
		const page =
			def.key === 'privacy' || def.key === 'terms'
				? crawledPages.find((p) => p.role === def.key)
				: undefined;
		checks.push(legalCheck(def, found, page, ctx));
	}

	checks.push(
		makeCheck(
			'img-alt',
			'a11y',
			'Image alt text',
			tierFromCount(meta.missingAlts),
			meta.missingAlts === 0
				? 'All sampled images have alt text'
				: `${meta.missingAlts} image(s) missing alt`,
			fixPrompt('img-alt', { ...ctx, message: `${meta.missingAlts} missing alt` })
		)
	);
}
