import type { ScanCheck } from '$lib/scan/types';
import type { PageMeta } from '$lib/scan/parse';
import { WEIGHT_LIMITS } from '$lib/scan/constants';
import type { CheckCtx } from '$lib/scan/checks/helpers';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';

function normalizePath(url: URL): string {
	const path = url.pathname.replace(/\/$/, '') || '/';
	return `${url.origin}${path}`;
}

export function pushLaunchSignalChecks(
	checks: ScanCheck[],
	meta: PageMeta,
	finalUrl: URL,
	ctx: CheckCtx,
	ogImageOk: boolean | null
): void {
	checks.push(
		makeCheck(
			'noindex',
			'seo',
			'Search indexing',
			meta.robotsNoindex ? 'fail' : 'pass',
			meta.robotsNoindex
				? 'Page has meta robots noindex — hidden from Google'
				: 'No noindex directive on homepage',
			fixPrompt('noindex', ctx)
		)
	);

	let canonicalStatus: ScanCheck['status'] = 'warn';
	let canonicalMessage = 'No canonical URL — duplicate URLs may split SEO';
	if (meta.canonical) {
		try {
			const canonicalUrl = new URL(meta.canonical, finalUrl);
			canonicalStatus =
				normalizePath(canonicalUrl) === normalizePath(finalUrl) ? 'pass' : 'warn';
			canonicalMessage =
				canonicalStatus === 'pass'
					? `Canonical matches this page (${canonicalUrl.href})`
					: `Canonical points elsewhere (${canonicalUrl.href})`;
		} catch {
			canonicalStatus = 'warn';
			canonicalMessage = 'Canonical URL is invalid';
		}
	}

	checks.push(
		makeCheck(
			'canonical',
			'seo',
			'Canonical URL',
			canonicalStatus,
			canonicalMessage,
			fixPrompt('canonical', ctx)
		)
	);

	const hasOg = Boolean(meta.ogTitle || meta.ogDescription || meta.ogImage);
	let twitterStatus: ScanCheck['status'] = 'pass';
	let twitterMessage = 'Twitter/X card tags present';
	if (hasOg && !meta.twitterCard) {
		twitterStatus = 'warn';
		twitterMessage = 'Missing twitter:card — X may not render a rich preview';
	} else if (meta.twitterCard === 'summary_large_image' && !meta.twitterImage && !meta.ogImage) {
		twitterStatus = 'warn';
		twitterMessage = 'summary_large_image without twitter:image or og:image';
	}

	checks.push(
		makeCheck(
			'twitter-card',
			'seo',
			'X / Twitter card',
			twitterStatus,
			twitterMessage,
			fixPrompt('twitter-card', ctx)
		)
	);

	let weightStatus: ScanCheck['status'] = 'pass';
	let weightMessage = `${Math.round(meta.htmlBytes / 1024)}KB HTML · ${meta.scriptCount} scripts`;
	if (
		meta.htmlBytes >= WEIGHT_LIMITS.htmlFailBytes ||
		meta.scriptCount >= WEIGHT_LIMITS.scriptFailCount
	) {
		weightStatus = 'fail';
		weightMessage += ' — heavy page may feel slow on first visit';
	} else if (
		meta.htmlBytes >= WEIGHT_LIMITS.htmlWarnBytes ||
		meta.scriptCount >= WEIGHT_LIMITS.scriptWarnCount ||
		meta.blockingScripts >= WEIGHT_LIMITS.blockingScriptWarn
	) {
		weightStatus = 'warn';
		weightMessage += ` · ${meta.blockingScripts} blocking script(s) in <head>`;
	}

	checks.push(
		makeCheck(
			'page-weight',
			'launch',
			'Page weight',
			weightStatus,
			weightMessage,
			fixPrompt('page-weight', { ...ctx, message: weightMessage })
		)
	);

	if (ogImageOk !== null) {
		checks.push(
			makeCheck(
				'og-image-live',
				'seo',
				'Share preview image loads',
				ogImageOk ? 'pass' : 'fail',
				ogImageOk
					? 'og:image URL responds — previews should render'
					: 'og:image URL failed to load — broken card when shared',
				fixPrompt('og-image-live', ctx)
			)
		);
	}
}
