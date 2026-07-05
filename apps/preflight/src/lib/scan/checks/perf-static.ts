import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';
import type { ScanCheck } from '$lib/scan/types';

const BLOAT_THRESHOLD = 150 * 1024;

function attr(tag: string, name: string): string | null {
	const re = new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i');
	return tag.match(re)?.[2] ?? null;
}

function hasAttr(tag: string, name: string): boolean {
	return new RegExp(`\\b${name}\\s*(?:=|\\s|>|/)`, 'i').test(tag);
}

function imgIsSized(tag: string): boolean {
	if (attr(tag, 'width') || attr(tag, 'height')) return true;
	const style = attr(tag, 'style') ?? '';
	return /\bwidth\s*:/i.test(style) && /\bheight\s*:/i.test(style);
}

function extractImgTags(html: string): string[] {
	return [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
}

function headHtml(html: string): string | null {
	const open = html.match(/<head\b[^>]*>/i);
	if (!open) return null;
	const start = html.indexOf(open[0]) + open[0].length;
	const close = html.indexOf('</head>', start);
	return close === -1 ? html.slice(start) : html.slice(start, close);
}

function originOf(urlStr: string, base: string): string | null {
	try {
		const u = new URL(urlStr, base);
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
		return u.origin.toLowerCase();
	} catch {
		return null;
	}
}

function pushImgDimensionsCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const imgs = extractImgTags(html);
	if (imgs.length < 3) return;

	const missing = imgs.filter((tag) => !imgIsSized(tag)).length;
	checks.push(
		makeCheck(
			'img-dimensions',
			'launch',
			'Image dimensions',
			missing === 0 ? 'pass' : 'warn',
			missing === 0
				? `All ${imgs.length} images declare dimensions`
				: `${missing} of ${imgs.length} images missing width/height — the page reflows as they load (layout shift)`,
			fixPrompt('img-dimensions', ctx)
		)
	);
}

function pushImgLazyCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const imgs = extractImgTags(html);
	if (imgs.length < 4) return;

	const lazyCount = imgs.filter((tag) => {
		const loading = attr(tag, 'loading')?.trim().toLowerCase();
		return loading === 'lazy';
	}).length;

	checks.push(
		makeCheck(
			'img-lazy',
			'launch',
			'Image lazy loading',
			lazyCount > 0 ? 'pass' : 'warn',
			lazyCount > 0
				? `At least one of ${imgs.length} images uses loading="lazy"`
				: `${imgs.length} images, none lazy-load — below-the-fold images compete with critical content`,
			fixPrompt('img-lazy', ctx)
		)
	);
}

function hasFontFace(html: string): boolean {
	return /@font-face\b/i.test(html);
}

function googleFontLinks(html: string): string[] {
	const links: string[] = [];
	for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
		const rel = (attr(tag[0], 'rel') ?? '').toLowerCase();
		const href = attr(tag[0], 'href') ?? '';
		if (rel.includes('stylesheet') && /fonts\.googleapis\.com/i.test(href)) {
			links.push(href);
		}
	}
	return links;
}

function pushFontLoadingCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const gfLinks = googleFontLinks(html);
	const hasInlineFonts = hasFontFace(html);
	if (!hasInlineFonts && gfLinks.length === 0) return;

	let warn = false;
	if (hasInlineFonts) {
		for (const block of html.matchAll(/@font-face\s*\{[^}]*\}/gi)) {
			if (!/font-display\s*:/i.test(block[0])) {
				warn = true;
				break;
			}
		}
	}
	if (!warn && gfLinks.length > 0) {
		warn = gfLinks.some((href) => !/display=/i.test(href));
	}

	checks.push(
		makeCheck(
			'font-loading',
			'launch',
			'Font loading',
			warn ? 'warn' : 'pass',
			warn
				? 'Custom fonts without font-display — text is invisible while fonts load (FOIT)'
				: hasInlineFonts
					? 'Custom fonts declare font-display'
					: 'Google Fonts loaded with display=swap',
			fixPrompt('font-loading', ctx)
		)
	);
}

function thirdPartyOrigins(html: string, ctx: { url: string }): Set<string> {
	const pageOrigin = originOf(ctx.url, ctx.url);
	const hosts = new Set<string>();
	const base = ctx.url;

	const collect = (urlStr: string | null) => {
		if (!urlStr) return;
		const origin = originOf(urlStr, base);
		if (origin && origin !== pageOrigin) hosts.add(origin);
	};

	for (const m of html.matchAll(/\bsrc\s*=\s*(["'])([^"']+)\1/gi)) collect(m[2]);
	for (const m of html.matchAll(/\bhref\s*=\s*(["'])([^"']+)\1/gi)) collect(m[2]);

	return hosts;
}

function hasPreconnectHint(html: string): boolean {
	for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
		const rel = (attr(tag[0], 'rel') ?? '').toLowerCase();
		if (rel.includes('preconnect') || rel.includes('dns-prefetch')) return true;
	}
	return false;
}

function pushPreconnectCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const origins = thirdPartyOrigins(html, ctx);
	if (origins.size < 2) return;

	checks.push(
		makeCheck(
			'preconnect',
			'launch',
			'Preconnect hints',
			hasPreconnectHint(html) ? 'pass' : 'warn',
			hasPreconnectHint(html)
				? 'Preconnect or dns-prefetch hints present for third-party origins'
				: `${origins.size} third-party origins with no preconnect — each first connection pays full DNS+TLS cost`,
			fixPrompt('preconnect', ctx)
		)
	);
}

function countBlockingStylesheets(head: string): number {
	let count = 0;
	for (const tag of head.matchAll(/<link\b[^>]*>/gi)) {
		const rel = (attr(tag[0], 'rel') ?? '').toLowerCase();
		if (!rel.includes('stylesheet')) continue;
		if (hasAttr(tag[0], 'disabled')) continue;
		const media = (attr(tag[0], 'media') ?? '').trim().toLowerCase();
		if (media === 'print') continue;
		count++;
	}
	return count;
}

function pushBlockingCssCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const head = headHtml(html);
	if (head === null) return;

	const count = countBlockingStylesheets(head);
	checks.push(
		makeCheck(
			'blocking-css',
			'launch',
			'Render-blocking CSS',
			count >= 4 ? 'warn' : 'pass',
			count >= 4
				? `${count} render-blocking stylesheets in <head> — consolidate or inline critical CSS`
				: count === 0
					? 'No render-blocking stylesheets in <head>'
					: `${count} render-blocking stylesheet(s) in <head>`,
			fixPrompt('blocking-css', ctx)
		)
	);
}

function looksLikeJsonState(content: string): boolean {
	const trimmed = content.trim();
	if (trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
	return /__NEXT_DATA__|window\.__|JSON\.parse/i.test(content);
}

function pushInlineDataBloatCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const encoder = new TextEncoder();
	let totalBytes = 0;

	for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
		if (/\bsrc\s*=/i.test(m[1])) continue;
		const content = m[2];
		if (looksLikeJsonState(content)) {
			totalBytes += encoder.encode(content).length;
		}
	}

	if (totalBytes === 0) return;

	const kb = Math.round(totalBytes / 1024);
	checks.push(
		makeCheck(
			'inline-data-bloat',
			'launch',
			'Inline data payload',
			totalBytes > BLOAT_THRESHOLD ? 'warn' : 'pass',
			totalBytes > BLOAT_THRESHOLD
				? `~${kb}KB of inline JSON state ships with the HTML — trim server-serialized data`
				: `Inline data payload is modest (~${kb}KB)`,
			fixPrompt('inline-data-bloat', ctx)
		)
	);
}

export function pushPerfStaticChecks(
	checks: ScanCheck[],
	html: string,
	ctx: { url: string }
): void {
	pushImgDimensionsCheck(checks, html, ctx);
	pushImgLazyCheck(checks, html, ctx);
	pushFontLoadingCheck(checks, html, ctx);
	pushPreconnectCheck(checks, html, ctx);
	pushBlockingCssCheck(checks, html, ctx);
	pushInlineDataBloatCheck(checks, html, ctx);
}
