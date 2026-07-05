import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';
import type { ScanCheck } from '$lib/scan/types';

const SOCIAL_HOST =
	/(?:^|\/\/)(?:www\.)?(twitter\.com|x\.com|github\.com|linkedin\.com|instagram\.com|facebook\.com|youtube\.com|discord\.gg|discord\.com\/invite|t\.me)\b/i;

const TEMPLATE_TITLES = new Set([
	'vite app',
	'vite + svelte',
	'vite + react',
	'create next app',
	'react app',
	'welcome to sveltekit',
	'astro',
	'document',
	'untitled',
	'home'
]);

function stripForText(html: string): string {
	return html
		.replaceAll(/<(script|style|svg)\b[\s\S]*?<\/\1\s*>/gi, '')
		.replaceAll(/<[^>]+>/g, ' ')
		.replaceAll(/\s+/g, ' ')
		.trim();
}

function extractTitle(html: string): string | null {
	const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	return m?.[1]?.trim() ?? null;
}

function latestCopyrightYear(text: string): number | null {
	const re = /(?:©|&copy;|\(c\)|copyright)\s*(\d{4})(?:\s*[-–]\s*(\d{4}))?/gi;
	let latest: number | null = null;
	for (const m of text.matchAll(re)) {
		const end = m[2] ? Number(m[2]) : Number(m[1]);
		if (!Number.isNaN(end) && (latest === null || end > latest)) latest = end;
	}
	return latest;
}

function pushCopyrightYearCheck(
	checks: ScanCheck[],
	html: string,
	ctx: { url: string },
	now: Date
): void {
	const year = latestCopyrightYear(stripForText(html));
	if (year === null) return;

	const current = now.getFullYear();
	checks.push(
		makeCheck(
			'copyright-year',
			'launch',
			'Copyright year',
			year <= current - 2 ? 'warn' : 'pass',
			year <= current - 2
				? `Footer says © ${year} — a stale copyright reads as an abandoned project; update it (or render the year dynamically)`
				: `Copyright year is current (${year})`,
			fixPrompt('copyright-year', ctx)
		)
	);
}

function socialPathLooksPlaceholder(href: string): boolean {
	if (!href || href === '#') return true;
	try {
		const u = new URL(href, 'https://example.test');
		const path = u.pathname.replace(/\/+$/, '');
		if (path === '' || path === '/') return true;
		if (/yourhandle|username|example/i.test(href)) return true;
		return false;
	} catch {
		return href === '#';
	}
}

function collectSocialHrefs(html: string): string[] {
	const hrefs: string[] = [];
	for (const m of html.matchAll(/\bhref\s*=\s*(["'])([^"']*)\1/gi)) {
		if (SOCIAL_HOST.test(m[2])) hrefs.push(m[2]);
	}
	return hrefs;
}

function pushDeadSocialLinksCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const hrefs = collectSocialHrefs(html);
	if (hrefs.length === 0) return;

	const dead = hrefs.filter((href) => socialPathLooksPlaceholder(href));
	if (dead.length > 0) {
		checks.push(
			makeCheck(
				'dead-social-links',
				'launch',
				'Social profile links',
				'warn',
				`${dead.length} social links go nowhere (twitter.com with no handle) — placeholder links scream 'template'; fill them in or remove the icons`,
				fixPrompt('dead-social-links', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'dead-social-links',
			'launch',
			'Social profile links',
			'pass',
			`${hrefs.length} social profile${hrefs.length === 1 ? '' : 's'} linked`,
			fixPrompt('dead-social-links', ctx)
		)
	);
}

function anchorTargetExists(html: string, id: string): boolean {
	const escaped = id.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return (
		new RegExp(`\\bid\\s*=\\s*(["'])${escaped}\\1`, 'i').test(html) ||
		new RegExp(`\\bname\\s*=\\s*(["'])${escaped}\\1`, 'i').test(html)
	);
}

function pushBrokenAnchorNavCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const anchors: string[] = [];
	let stubCount = 0;

	for (const m of html.matchAll(/\bhref\s*=\s*(["'])(#[^"']*)\1/gi)) {
		const href = m[2];
		if (href === '#') {
			stubCount++;
			continue;
		}
		const id = href.slice(1);
		if (id) anchors.push(id);
	}

	if (anchors.length === 0 && stubCount < 3) return;

	const missing = anchors.filter((id) => !anchorTargetExists(html, id));
	if (missing.length > 0 || stubCount >= 3) {
		let message = '';
		if (missing.length > 0) {
			message = `${missing.length} nav links point to missing sections (#${missing[0]} has no target) — clicking does nothing`;
		}
		if (stubCount >= 3) {
			const stubPart = `plus ${stubCount} links are href='#' stubs`;
			message = message ? `${message}; ${stubPart}` : stubPart;
		}
		checks.push(
			makeCheck(
				'broken-anchor-nav',
				'launch',
				'In-page anchor links',
				'warn',
				message,
				fixPrompt('broken-anchor-nav', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'broken-anchor-nav',
			'launch',
			'In-page anchor links',
			'pass',
			`In-page anchors all resolve (${anchors.length} checked)`,
			fixPrompt('broken-anchor-nav', ctx)
		)
	);
}

function pushDefaultFaviconTitleCheck(
	checks: ScanCheck[],
	html: string,
	ctx: { url: string }
): void {
	const title = extractTitle(html);
	const titleHit = title !== null && TEMPLATE_TITLES.has(title.trim().toLowerCase());
	const faviconHit =
		/\bhref\s*=\s*(["'])[^"']*(?:vite\.svg|\/src\/assets\/)[^"']*\1/i.test(html) ||
		/<link\b[^>]*\brel\s*=\s*(["'])[^"']*icon[^"']*\1[^>]*\bhref\s*=\s*(["'])[^"']*(?:vite\.svg|\/src\/assets\/)/i.test(
			html
		);

	if (!titleHit && !faviconHit) return;

	const label = titleHit ? title!.trim() : 'template favicon';
	checks.push(
		makeCheck(
			'default-favicon-title',
			'launch',
			'Template leftovers',
			'warn',
			`Template leftovers: title is "${label}" — the #1 tell of an unfinished launch`,
			fixPrompt('default-favicon-title', ctx)
		)
	);
}

function parseDateFromContext(text: string, index: number): Date | null {
	const slice = text.slice(index, index + 40);
	const iso = slice.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
	if (iso) {
		const d = new Date(iso[1]);
		if (!Number.isNaN(d.getTime())) return d;
	}
	const yearMonth = slice.match(/\b(20\d{2})[-/.](\d{1,2})\b/);
	if (yearMonth) {
		const d = new Date(Number(yearMonth[1]), Number(yearMonth[2]) - 1, 1);
		if (!Number.isNaN(d.getTime())) return d;
	}
	const yearOnly = slice.match(/\b(20\d{2})\b/);
	if (yearOnly) return new Date(Number(yearOnly[1]), 0, 1);
	return null;
}

function pushLastUpdatedStalenessCheck(
	checks: ScanCheck[],
	html: string,
	ctx: { url: string },
	now: Date
): void {
	const text = stripForText(html);
	const re = /\b(?:last updated|updated on|posted on)\b/gi;
	let newest: Date | null = null;
	let newestLabel = '';

	for (const m of text.matchAll(re)) {
		const idx = m.index ?? 0;
		const parsed = parseDateFromContext(text, idx + m[0].length);
		if (parsed && (newest === null || parsed > newest)) {
			newest = parsed;
			newestLabel = text.slice(idx, idx + 50).trim();
		}
	}

	if (newest === null) return;

	const monthsAgo =
		(now.getFullYear() - newest.getFullYear()) * 12 + (now.getMonth() - newest.getMonth());
	const stale = monthsAgo > 18;

	checks.push(
		makeCheck(
			'last-updated-staleness',
			'launch',
			'Content freshness',
			stale ? 'warn' : 'pass',
			stale
				? `Page says '${newestLabel}' — stale timestamps undermine trust; update or remove them`
				: 'Freshness timestamp present and recent',
			fixPrompt('last-updated-staleness', ctx)
		)
	);
}

export function pushTrustChecks(
	checks: ScanCheck[],
	html: string,
	ctx: { url: string },
	now: Date = new Date()
): void {
	pushCopyrightYearCheck(checks, html, ctx, now);
	pushDeadSocialLinksCheck(checks, html, ctx);
	pushBrokenAnchorNavCheck(checks, html, ctx);
	pushDefaultFaviconTitleCheck(checks, html, ctx);
	pushLastUpdatedStalenessCheck(checks, html, ctx, now);
}
