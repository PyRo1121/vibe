import type { ScanCheck } from '$lib/scan/types';
import { visibleText } from '$lib/scan/signals';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';

const PRODUCT_SIGNALS = [
	/\bpricing\b|\bprice\b|\/mo\b|\bper month\b/i,
	/\bsign\s*up\b|\bget started\b|\btry(?:\s+(?:it|for))?\s*free\b|\bstart free\b/i,
	/\bfeatures\b|\bhow it works\b/i,
	/\blogin\b|\blog in\b|\bsign in\b/i
] as const;

const CTA_VERB =
	/\b(get started|sign up|try free|start(?:\s+free)?\s+trial|buy|download|install|book(?:\s+a)?\s+demo|join(?:\s+the)?\s+waitlist|subscribe|request access)\b/i;

function bodyMarkup(html: string): string {
	const m = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
	return m?.[1] ?? html;
}

function stripForScan(html: string): string {
	return html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1\s*>/gi, '');
}

function elementText(inner: string): string {
	return inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncateQuote(text: string, max = 60): string {
	return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function looksLikeProductPage(html: string): boolean {
	const text = visibleText(html);
	let hits = 0;
	for (const re of PRODUCT_SIGNALS) {
		if (re.test(text)) hits++;
	}
	return hits >= 2;
}

interface CtaMatch {
	text: string;
	index: number;
}

function findCtas(markup: string): CtaMatch[] {
	const ctas: CtaMatch[] = [];
	const re =
		/<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
	for (const m of markup.matchAll(re)) {
		const text = elementText(m[1]);
		if (text && CTA_VERB.test(text)) {
			ctas.push({ text, index: m.index ?? 0 });
		}
	}
	return ctas;
}

function pushPrimaryCtaCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const markup = stripForScan(bodyMarkup(html));
	const ctas = findCtas(markup);
	if (ctas.length === 0) {
		checks.push(
			makeCheck(
				'primary-cta',
				'launch',
				'Primary call-to-action',
				'warn',
				'No clear call-to-action found — visitors have no obvious next step',
				fixPrompt('primary-cta', ctx)
			)
		);
		return;
	}

	const fold = Math.floor(markup.length * 0.4);
	const early = ctas.find((c) => c.index < fold);
	if (early) {
		checks.push(
			makeCheck(
				'primary-cta',
				'launch',
				'Primary call-to-action',
				'pass',
				`Clear CTA above the fold: "${truncateQuote(early.text)}"`,
				fixPrompt('primary-cta', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'primary-cta',
			'launch',
			'Primary call-to-action',
			'warn',
			'Primary CTA appears late in the page — launch traffic decides in seconds; put one above the fold',
			fixPrompt('primary-cta', ctx)
		)
	);
}

function pushCtaCompetitionCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const markup = stripForScan(bodyMarkup(html));
	const seen = new Set<string>();
	for (const cta of findCtas(markup)) {
		seen.add(cta.text.toLowerCase().replace(/\s+/g, ' ').trim());
	}
	if (seen.size === 0) return;

	checks.push(
		makeCheck(
			'cta-competition',
			'launch',
			'CTA focus',
			seen.size >= 8 ? 'warn' : 'pass',
			seen.size >= 8
				? `${seen.size} competing calls-to-action — decision fatigue kills conversion; pick one primary action`
				: `Focused CTA set (${seen.size} distinct)`,
			fixPrompt('cta-competition', ctx)
		)
	);
}

function pushPricingPathCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const text = visibleText(html);
	const hasCurrency = /[$€£]\s?\d+/.test(text);

	for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
		const tag = m[0];
		const linkText = elementText(m[1]).toLowerCase();
		const href = (tag.match(/\bhref\s*=\s*(["'])([^"']*)\1/i)?.[2] ?? '').toLowerCase();
		if (/pricing|plans|#pricing/.test(href) || /pricing|plans/.test(linkText)) {
			checks.push(
				makeCheck(
					'pricing-path',
					'launch',
					'Pricing visibility',
					'pass',
					'Pricing signal present on the page',
					fixPrompt('pricing-path', ctx)
				)
			);
			return;
		}
	}

	if (hasCurrency) {
		checks.push(
			makeCheck(
				'pricing-path',
				'launch',
				'Pricing visibility',
				'pass',
				'Pricing signal present on the page',
				fixPrompt('pricing-path', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'pricing-path',
			'launch',
			'Pricing visibility',
			'warn',
			"No pricing signal — 'how much?' is the first question serious buyers ask; even 'free during beta' converts better than silence",
			fixPrompt('pricing-path', ctx)
		)
	);
}

function hasSocialProof(text: string): boolean {
	if (/\btestimonial\b/i.test(text)) return true;
	if (/\btrusted by\b/i.test(text)) return true;
	if (/\bused by\b/i.test(text)) return true;
	if (/\bloved by\b/i.test(text)) return true;
	if (/\bcustomer stories\b/i.test(text)) return true;
	if (/\bcase stud(?:y|ies)\b/i.test(text)) return true;
	if (/\d+\+?\s*reviews?\b/i.test(text)) return true;
	const stars = (text.match(/[★⭐]/g) ?? []).length;
	return stars >= 2;
}

function pushSocialProofCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const text = visibleText(html);
	checks.push(
		makeCheck(
			'social-proof',
			'launch',
			'Social proof',
			hasSocialProof(text) ? 'pass' : 'warn',
			hasSocialProof(text)
				? 'Social proof signals present near the offer'
				: "No social proof — even 3 honest user quotes or a usage number ('2,000 scans run') lifts trust at launch",
			fixPrompt('social-proof', ctx)
		)
	);
}

function attr(tag: string, name: string): string | null {
	const re = new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i');
	return tag.match(re)?.[2] ?? null;
}

function isRequiredInput(tag: string): boolean {
	const type = (attr(tag, 'type') ?? 'text').toLowerCase();
	if (type === 'hidden' || type === 'submit' || type === 'checkbox') return false;
	if (/\brequired\b/i.test(tag)) return true;
	const aria = (attr(tag, 'aria-required') ?? '').toLowerCase();
	return aria === 'true';
}

function pushSignupFrictionCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const scan = stripForScan(html);
	for (const m of scan.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/gi)) {
		const formHtml = m[0];
		if (!/<input\b[^>]*\btype\s*=\s*(["'])email\1/i.test(formHtml)) continue;

		let required = 0;
		for (const input of formHtml.matchAll(/<input\b[^>]*>/gi)) {
			if (isRequiredInput(input[0])) required++;
		}

		if (required === 0) return;

		checks.push(
			makeCheck(
				'signup-friction',
				'launch',
				'Signup friction',
				required >= 4 ? 'warn' : 'pass',
				required >= 4
					? `Signup form asks for ${required} fields — every extra field cuts completions; launch with email-only if you can`
					: `Signup friction is low (${required} field${required === 1 ? '' : 's'})`,
				fixPrompt('signup-friction', ctx)
			)
		);
		return;
	}
}

export function pushConversionChecks(
	checks: ScanCheck[],
	html: string,
	ctx: { url: string }
): void {
	if (!looksLikeProductPage(html)) return;

	pushPrimaryCtaCheck(checks, html, ctx);
	pushCtaCompetitionCheck(checks, html, ctx);
	pushPricingPathCheck(checks, html, ctx);
	pushSocialProofCheck(checks, html, ctx);
	pushSignupFrictionCheck(checks, html, ctx);
}
