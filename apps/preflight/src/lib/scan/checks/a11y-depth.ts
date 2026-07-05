import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';
import type { ScanCheck } from '$lib/scan/types';

const FIELD_TYPES = new Set(['text', 'email', 'password', 'tel', 'url', 'search', 'number']);

function stripBlocks(html: string): string {
	return html.replaceAll(/<(script|style|svg)\b[\s\S]*?<\/\1\s*>/gi, '');
}

function attr(tag: string, name: string): string | null {
	const re = new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i');
	return tag.match(re)?.[2] ?? null;
}

function bodyHtml(html: string): string {
	const m = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
	return m?.[1] ?? html;
}

function pushFormLabelsCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const scan = stripBlocks(html);
	const fields: string[] = [];

	for (const m of scan.matchAll(/<input\b[^>]*>/gi)) {
		const tag = m[0];
		const type = (attr(tag, 'type') ?? 'text').toLowerCase();
		if (type === 'hidden' || type === 'submit' || type === 'checkbox') continue;
		if (!FIELD_TYPES.has(type)) continue;
		fields.push(tag);
	}
	for (const m of scan.matchAll(/<textarea\b[^>]*>/gi)) fields.push(m[0]);
	for (const m of scan.matchAll(/<select\b[^>]*>/gi)) fields.push(m[0]);

	if (fields.length === 0) return;

	const labeledIds = new Set<string>();
	for (const m of scan.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)) {
		const forId = attr(m[0], 'for');
		if (forId) labeledIds.add(forId);
		if (/<(?:input|textarea|select)\b/i.test(m[1])) {
			// Wrapping label — mark inner fields as labeled via a synthetic marker.
			for (const inner of m[1].matchAll(/<(?:input|textarea|select)\b[^>]*>/gi)) {
				const id = attr(inner[0], 'id');
				if (id) labeledIds.add(id);
				else fields.splice(fields.indexOf(inner[0]), 1, '__wrapped__');
			}
		}
	}

	let unlabeled = 0;
	for (const tag of fields) {
		if (tag === '__wrapped__') continue;
		const id = attr(tag, 'id');
		if (id && labeledIds.has(id)) continue;
		if (attr(tag, 'aria-label') || attr(tag, 'aria-labelledby') || attr(tag, 'title')) continue;
		const placeholder = attr(tag, 'placeholder');
		if (placeholder && !attr(tag, 'aria-label')) {
			unlabeled++;
			continue;
		}
		if (!id || !labeledIds.has(id)) unlabeled++;
	}

	checks.push(
		makeCheck(
			'form-labels',
			'a11y',
			'Form field labels',
			unlabeled === 0 ? 'pass' : 'warn',
			unlabeled === 0
				? `All ${fields.length} form fields have labels`
				: `${unlabeled} of ${fields.length} form fields lack a real label — placeholder text is not a label`,
			fixPrompt('form-labels', ctx)
		)
	);
}

function visibleText(tag: string): string {
	return tag
		.replaceAll(/<[^>]+>/g, '')
		.replaceAll(/\s+/g, ' ')
		.trim();
}

function hasAccessibleName(tag: string, innerHtml: string): boolean {
	if (attr(tag, 'aria-label') || attr(tag, 'aria-labelledby')) return true;
	const text = visibleText(innerHtml);
	if (text.length > 0) return true;
	if (/<img\b[^>]*\balt=["'][^"']+["']/i.test(innerHtml)) return true;
	return false;
}

function pushAccessibleNamesCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const scan = stripBlocks(html);
	let unnamedButtons = 0;
	let unnamedLinks = 0;
	let hasInteractive = false;

	for (const m of scan.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)) {
		hasInteractive = true;
		if (!hasAccessibleName(m[0], m[1])) unnamedButtons++;
	}
	for (const m of scan.matchAll(/<[^>]+\brole=["']button["'][^>]*>([\s\S]*?)<\/[^>]+>/gi)) {
		hasInteractive = true;
		if (!hasAccessibleName(m[0], m[1])) unnamedButtons++;
	}
	for (const m of scan.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
		hasInteractive = true;
		if (!hasAccessibleName(m[0], m[1])) unnamedLinks++;
	}

	if (!hasInteractive) return;

	const total = unnamedButtons + unnamedLinks;
	checks.push(
		makeCheck(
			'accessible-names',
			'a11y',
			'Accessible names',
			total === 0 ? 'pass' : 'warn',
			total === 0
				? 'Buttons and links have accessible names'
				: `${unnamedButtons} button(s) and ${unnamedLinks} link(s) have no accessible name — screen readers announce 'button' with no context`,
			fixPrompt('accessible-names', ctx)
		)
	);
}

function pushLandmarksCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const hasMain = /<main\b/i.test(html) || /\brole=["']main["']/i.test(html);
	checks.push(
		makeCheck(
			'landmarks',
			'a11y',
			'Main landmark',
			hasMain ? 'pass' : 'warn',
			hasMain
				? '<main> landmark present'
				: 'No <main> landmark — screen-reader users cannot skip to content',
			fixPrompt('landmarks', ctx)
		)
	);
}

function pushPositiveTabindexCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	let count = 0;
	for (const m of html.matchAll(/\btabindex\s*=\s*(["'])(\d+)\1/gi)) {
		if (Number(m[2]) >= 1) count++;
	}
	checks.push(
		makeCheck(
			'positive-tabindex',
			'a11y',
			'Tab order',
			count === 0 ? 'pass' : 'warn',
			count === 0
				? 'No positive tabindex values'
				: `${count} element(s) use tabindex > 0 — overrides natural tab order and confuses keyboard users`,
			fixPrompt('positive-tabindex', ctx)
		)
	);
}

function pushSkipLinkCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	if (!/<nav\b/i.test(html)) return;
	const linkCount = (html.match(/<a\b/gi) ?? []).length;
	if (linkCount < 20) return;

	const body = bodyHtml(html);
	const early = body.slice(0, 1500);
	const hasSkip = /<a\b[^>]*href=["']#[^"']*["'][^>]*>[\s\S]*?skip[\s\S]*?<\/a>/i.test(early);

	checks.push(
		makeCheck(
			'skip-link',
			'a11y',
			'Skip link',
			hasSkip ? 'pass' : 'warn',
			hasSkip
				? 'Skip link present for keyboard users'
				: 'Long nav with no skip link — keyboard users must tab through every item',
			fixPrompt('skip-link', ctx)
		)
	);
}

export function pushA11yDepthChecks(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	pushFormLabelsCheck(checks, html, ctx);
	pushAccessibleNamesCheck(checks, html, ctx);
	pushLandmarksCheck(checks, html, ctx);
	pushPositiveTabindexCheck(checks, html, ctx);
	pushSkipLinkCheck(checks, html, ctx);
}
