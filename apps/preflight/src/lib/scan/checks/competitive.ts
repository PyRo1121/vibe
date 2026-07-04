import type { ScanCheck } from '$lib/scan/types';
import type { CrawledPage } from '$lib/scan/crawl';
import type { LinkCheckResult, ScanContext } from '$lib/scan/checks/context';
import { pagePath, type CheckCtx } from '$lib/scan/checks/helpers';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';
import {
	detectAnalytics,
	detectConsentTool,
	findPlaceholderHints,
	hasCookieBasedAnalytics,
	hasJsonLd,
	robotsBlocksAllCrawlers,
	type AnalyticsStack
} from '$lib/scan/signals';

export function sitemapCheck(
	sitemapOk: boolean,
	sample: { checked: number; broken: number } | null,
	ctx: CheckCtx
): ScanCheck {
	let status: ScanCheck['status'] = sitemapOk ? 'pass' : 'warn';
	let message = sitemapOk ? 'sitemap.xml responds' : 'No sitemap.xml (helps discovery)';
	if (sitemapOk && sample && sample.checked > 0) {
		if (sample.broken > 0) {
			status = 'warn';
			message = `sitemap.xml lists unreachable URLs — ${sample.broken} of ${sample.checked} sampled failed`;
		} else {
			message = `sitemap.xml responds · ${sample.checked} sampled URL(s) reachable`;
		}
	}
	return makeCheck('sitemap', 'seo', 'sitemap.xml', status, message, fixPrompt('sitemap', ctx));
}

function cookieConsentCheck(html: string, analytics: AnalyticsStack[], ctx: CheckCtx): ScanCheck {
	const consentTool = detectConsentTool(html);
	const needsConsent = hasCookieBasedAnalytics(analytics);
	let status: ScanCheck['status'] = 'pass';
	let message: string;
	if (consentTool) {
		message = `${consentTool} consent banner detected`;
	} else if (needsConsent) {
		status = 'warn';
		message =
			'Cookie-based tracking (GA4/GTM/PostHog) with no consent banner — GDPR/ePrivacy risk for EU visitors';
	} else {
		message = 'No cookie-based trackers detected — consent banner not required';
	}
	return makeCheck(
		'cookie-consent',
		'legal',
		'Cookie consent',
		status,
		message,
		fixPrompt('cookie-consent', ctx)
	);
}

export function pushCompetitiveChecks(
	checks: ScanCheck[],
	html: string,
	ctx: CheckCtx,
	linkResult: LinkCheckResult,
	scanCtx: ScanContext,
	ogImageOk: boolean | null,
	crawledPages: CrawledPage[]
): void {
	const placeholderLabels = findPlaceholderHints(html).map((h) => h.label);
	for (const page of crawledPages) {
		if (!page.html) continue;
		const path = pagePath(page.url);
		for (const hit of findPlaceholderHints(page.html, 'subpage')) {
			placeholderLabels.push(`${hit.label} (on ${path})`);
		}
	}
	const pagesNote = crawledPages.length > 0 ? ` across ${crawledPages.length + 1} pages` : '';
	checks.push(
		makeCheck(
			'placeholder-copy',
			'launch',
			'Placeholder copy',
			placeholderLabels.length === 0 ? 'pass' : 'fail',
			placeholderLabels.length === 0
				? `No obvious template or TODO copy${pagesNote}`
				: placeholderLabels.join('; '),
			fixPrompt('placeholder-copy', {
				...ctx,
				message: placeholderLabels.join(', ')
			})
		),
		makeCheck(
			'json-ld',
			'seo',
			'Structured data (JSON-LD)',
			hasJsonLd(html) ? 'pass' : 'warn',
			hasJsonLd(html)
				? 'JSON-LD found — helps search and AI summaries'
				: 'No JSON-LD — add WebSite or Product schema for richer results',
			fixPrompt('json-ld', ctx)
		)
	);

	const analytics = detectAnalytics(html);
	checks.push(
		makeCheck(
			'analytics',
			'launch',
			'Analytics / measurement',
			analytics.length > 0 ? 'pass' : 'warn',
			analytics.length > 0
				? `Detected: ${analytics.join(', ')}`
				: 'No GA4, GTM, Plausible, PostHog, or Fathom detected — you cannot measure launch traffic',
			fixPrompt('analytics', ctx)
		),
		cookieConsentCheck(html, analytics, ctx),
		makeCheck(
			'llms-txt',
			'seo',
			'AI discovery (llms.txt)',
			linkResult.llmsTxtOk ? 'pass' : 'warn',
			linkResult.llmsTxtOk
				? 'llms.txt responds with usable content'
				: 'No llms.txt — AI assistants may miss context about your product',
			fixPrompt('llms-txt', ctx)
		)
	);

	if (linkResult.robotsOk && scanCtx.robotsText) {
		const blocked = robotsBlocksAllCrawlers(scanCtx.robotsText);
		checks.push(
			makeCheck(
				'robots-block',
				'seo',
				'robots.txt crawl rules',
				blocked ? 'fail' : 'pass',
				blocked
					? 'robots.txt blocks all crawlers (Disallow: /) — site hidden from Google'
					: 'robots.txt does not block the whole site',
				fixPrompt('robots-block', ctx)
			)
		);
	}

	if (scanCtx.redirectHops >= 2) {
		checks.push(
			makeCheck(
				'redirect-chain',
				'launch',
				'Redirect chain',
				scanCtx.redirectHops >= 4 ? 'fail' : 'warn',
				`${scanCtx.redirectHops} redirect hop(s) before final URL — extra latency on first visit`,
				fixPrompt('redirect-chain', { ...ctx, message: `${scanCtx.redirectHops} hops` })
			)
		);
	}

	const probe = scanCtx.ogImage;
	if (probe.reachable === true && probe.isImage === false) {
		checks.push(
			makeCheck(
				'og-image-type',
				'seo',
				'Share image content-type',
				'fail',
				`og:image returned ${probe.contentType ?? 'unknown type'} — not an image (SPA fallback?)`,
				fixPrompt('og-image-type', { ...ctx, message: probe.contentType ?? 'non-image' })
			)
		);
	} else if (ogImageOk && probe.isImage && probe.contentType) {
		checks.push(
			makeCheck(
				'og-image-type',
				'seo',
				'Share image content-type',
				'pass',
				`og:image serves ${probe.contentType.split(';')[0]}`,
				fixPrompt('og-image-type', ctx)
			)
		);
	}
}
