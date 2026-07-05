/** Launch-signal helpers — pure functions, no external deps (commercial-safe). */

export interface PlaceholderHit {
	label: string;
	snippet: string;
}

const PLACEHOLDER_PATTERNS: { re: RegExp; label: string }[] = [
	{ re: /\blorem ipsum\b/i, label: 'Lorem ipsum placeholder text' },
	{ re: /\bTODO\b/, label: 'TODO marker in visible copy' },
	{ re: /\bFIXME\b/i, label: 'FIXME marker in visible copy' },
	{ re: /your (company|product|brand|app) (name|here)/i, label: 'Template company name' },
	{ re: /\[your[^\]]+\]/i, label: 'Bracket placeholder copy' },
	{ re: /\bexample\.com\b/i, label: 'example.com placeholder domain' },
	{ re: /\b(test|demo)@example\.com\b/i, label: 'Placeholder email address' },
	{ re: /\bJohn Doe\b/, label: 'Generic placeholder name' },
	{ re: /\bPLACEHOLDER\b/i, label: 'PLACEHOLDER text' },
	{ re: /\bTBD\b/, label: 'TBD marker in copy' },
	{ re: /\bcoming soon\b/i, label: '"Coming soon" on a page meant to be live' },
	{ re: /\bunder construction\b/i, label: '"Under construction" copy' }
];

export function visibleText(html: string): string {
	return html
		.replaceAll(/<script[\s\S]*?<\/script>/gi, ' ')
		.replaceAll(/<style[\s\S]*?<\/style>/gi, ' ')
		.replaceAll(/<[^>]+>/g, ' ')
		.replaceAll(/\s+/g, ' ')
		.trim();
}

/**
 * Legal/pricing/docs sub-pages legitimately cite example.com and example
 * emails (privacy policies explain cookies with sample domains), so those
 * patterns only apply to the homepage.
 */
const HOMEPAGE_ONLY_LABELS = new Set([
	'example.com placeholder domain',
	'Placeholder email address'
]);

export function findPlaceholderHints(
	html: string,
	context: 'home' | 'subpage' = 'home'
): PlaceholderHit[] {
	const text = visibleText(html);
	const hits: PlaceholderHit[] = [];
	const seen = new Set<string>();

	for (const { re, label } of PLACEHOLDER_PATTERNS) {
		if (context === 'subpage' && HOMEPAGE_ONLY_LABELS.has(label)) continue;
		const match = text.match(re);
		if (!match || seen.has(label)) continue;
		seen.add(label);
		const idx = match.index ?? 0;
		const start = Math.max(0, idx - 20);
		const end = Math.min(text.length, idx + match[0].length + 30);
		hits.push({ label, snippet: text.slice(start, end).trim() });
	}

	return hits;
}

export function hasJsonLd(html: string): boolean {
	return /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
}

export type AnalyticsStack = 'ga4' | 'gtm' | 'plausible' | 'posthog' | 'fathom';

export function detectAnalytics(html: string): AnalyticsStack[] {
	const found = new Set<AnalyticsStack>();
	if (/googletagmanager\.com|gtm\.js/i.test(html)) found.add('gtm');
	// Measurement ID check is case-sensitive + word-bounded: lowercase strings
	// like CSS class names ("g-zinc900") must not count as a GA4 install.
	if (/google-analytics\.com|gtag\s*\(/i.test(html) || /\bG-[A-Z0-9]{8,}\b/.test(html))
		found.add('ga4');
	if (/plausible\.io/i.test(html)) found.add('plausible');
	if (/posthog\.com|posthog\.init/i.test(html)) found.add('posthog');
	if (/usefathom\.com|cdn\.usefathom\.com/i.test(html)) found.add('fathom');
	return [...found];
}

/** Analytics stacks that set cookies and therefore need consent in the EU. */
const COOKIE_BASED: ReadonlySet<AnalyticsStack> = new Set(['gtm', 'ga4', 'posthog']);

export function hasCookieBasedAnalytics(stacks: AnalyticsStack[]): boolean {
	return stacks.some((s) => COOKIE_BASED.has(s));
}

const CONSENT_TOOLS: Array<{ name: string; pattern: RegExp }> = [
	{ name: 'Cookiebot', pattern: /consent\.cookiebot\.com|cookiebot\.com\/uc\.js/i },
	{ name: 'OneTrust', pattern: /cdn\.cookielaw\.org|optanon/i },
	{ name: 'iubenda', pattern: /cdn\.iubenda\.com|iubenda_cs/i },
	{ name: 'CookieYes', pattern: /cdn-cookieyes\.com|cookieyes/i },
	{ name: 'Termly', pattern: /app\.termly\.io/i },
	{ name: 'Osano', pattern: /cmp\.osano\.com|osano\.js/i },
	{ name: 'Usercentrics', pattern: /usercentrics\.eu|usercentrics\.com/i },
	{ name: 'Didomi', pattern: /sdk\.privacy-center\.org|didomi/i },
	{ name: 'Klaro', pattern: /\bklaro(?:\.min)?\.js\b/i },
	{ name: 'Complianz', pattern: /complianz/i },
	{ name: 'tarteaucitron', pattern: /tarteaucitron/i },
	{ name: 'CookieConsent', pattern: /cookieconsent(?:\.min)?\.(?:js|css)/i }
];

/** Name of the first consent-management tool found in the HTML, or null. */
export function detectConsentTool(html: string): string | null {
	for (const tool of CONSENT_TOOLS) {
		if (tool.pattern.test(html)) return tool.name;
	}
	return null;
}

/** True when User-agent: * blocks the entire site (common staging mistake). */
export function robotsBlocksAllCrawlers(text: string): boolean {
	const normalized = text.replaceAll(/\r\n/g, '\n');
	const sections = normalized.split(/^User-agent:\s*/gim).slice(1);

	for (const section of sections) {
		const lines = section.split('\n');
		const agent = lines[0]?.trim().toLowerCase();
		if (agent !== '*') continue;

		const body = lines.slice(1).join('\n');
		const disallows = [...body.matchAll(/^Disallow:\s*(\S*)\s*$/gim)].map((m) => m[1]);
		const allows = [...body.matchAll(/^Allow:\s*(\S*)\s*$/gim)].map((m) => m[1]);

		if (disallows.includes('/') && !allows.includes('/')) return true;
	}

	return false;
}

export function llmsTxtLooksValid(text: string | null): boolean {
	if (!text) return false;
	const trimmed = text.trim();
	if (trimmed.length < 20) return false;
	if (/^<!DOCTYPE|<html\b/i.test(trimmed)) return false;
	return true;
}

/** RFC 9116 — Contact and security disclosure for researchers. */
export function securityTxtLooksValid(text: string | null): boolean {
	if (!text) return false;
	const trimmed = text.trim();
	if (trimmed.length < 10) return false;
	if (/^<!DOCTYPE|<html\b/i.test(trimmed)) return false;
	return (
		/Contact:/im.test(trimmed) || /Policy:/im.test(trimmed) || /Acknowledgments:/im.test(trimmed)
	);
}

export function isImageContentType(contentType: string | null): boolean {
	if (!contentType) return false;
	return contentType.split(';')[0]?.trim().toLowerCase().startsWith('image/') ?? false;
}
