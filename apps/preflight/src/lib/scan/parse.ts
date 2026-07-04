export function normalizeUrl(input: string): URL {
	const trimmed = input.trim();
	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	return new URL(withProtocol);
}

export function pickMeta(html: string, name: string): string | null {
	const re = new RegExp(
		`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']|` +
			`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
		'i'
	);
	const m = html.match(re);
	return (m?.[1] ?? m?.[2] ?? null)?.trim() || null;
}

export function pickTitle(html: string): string | null {
	const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
	return m?.[1]?.trim() || null;
}

export function hasViewport(html: string): boolean {
	return pickMeta(html, 'viewport') !== null;
}

export interface PageMeta {
	title: string | null;
	resolvedTitle: string | null;
	description: string | null;
	ogTitle: string | null;
	ogDescription: string | null;
	ogImage: string | null;
	viewport: boolean;
	favicon: boolean;
	appleTouchIcon: boolean;
	lang: string | null;
	h1: boolean;
	h1Count: number;
	missingAlts: number;
	links: string[];
	legal: ReturnType<typeof linkHints>;
	stack: ReturnType<typeof mentionsStack>;
	canonical: string | null;
	robotsNoindex: boolean;
	twitterCard: string | null;
	twitterImage: string | null;
	scriptCount: number;
	blockingScripts: number;
	htmlBytes: number;
}

export function parsePageMeta(html: string, finalUrl: URL, links?: string[]): PageMeta {
	const title = pickTitle(html);
	const ogTitle = pickMeta(html, 'og:title');
	const ogDescription = pickMeta(html, 'og:description');
	const ogImage = pickMeta(html, 'og:image');
	const description = pickMeta(html, 'description');
	const extractedLinks = links ?? extractLinks(html, finalUrl);

	return {
		title,
		resolvedTitle: ogTitle ?? title,
		description,
		ogTitle,
		ogDescription,
		ogImage,
		viewport: hasViewport(html),
		favicon: hasFavicon(html),
		appleTouchIcon: hasAppleTouchIcon(html),
		lang: htmlLang(html),
		h1: hasH1(html),
		h1Count: countH1s(html),
		missingAlts: countMissingAlts(html),
		links: extractedLinks,
		legal: linkHints(extractedLinks),
		stack: mentionsStack(html),
		canonical: pickCanonical(html),
		robotsNoindex: hasRobotsNoindex(html),
		twitterCard: pickMeta(html, 'twitter:card'),
		twitterImage: pickMeta(html, 'twitter:image'),
		scriptCount: countScriptTags(html),
		blockingScripts: countBlockingHeadScripts(html),
		htmlBytes: html.length
	};
}

export function htmlLang(html: string): string | null {
	const m = html.match(/<html[^>]+lang=["']([^"']+)["']/i);
	return m?.[1] ?? null;
}

export function countMissingAlts(html: string): number {
	const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
	let missing = 0;
	for (const img of imgs) {
		if (!/\balt=["'][^"']*["']/i.test(img[0])) missing += 1;
	}
	return missing;
}

export function hasH1(html: string): boolean {
	return /<h1[\s>]/i.test(html);
}

export function countH1s(html: string): number {
	return (html.match(/<h1[\s>]/gi) ?? []).length;
}

export function hasAppleTouchIcon(html: string): boolean {
	return /<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["']/i.test(html);
}

export function hasFavicon(html: string): boolean {
	return /<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html);
}

export function pickCanonical(html: string): string | null {
	const m = html.match(/<link\b[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
	if (m?.[1]) return m[1].trim();
	const m2 = html.match(/<link\b[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
	return m2?.[1]?.trim() ?? null;
}

export function hasRobotsNoindex(html: string): boolean {
	const tags = [...html.matchAll(/<meta\b[^>]+name=["']robots["'][^>]*>/gi)];
	for (const tag of tags) {
		const content = tag[0].match(/content=["']([^"']*)["']/i)?.[1]?.toLowerCase() ?? '';
		if (content.includes('noindex')) return true;
	}
	return false;
}

export function countScriptTags(html: string): number {
	return [...html.matchAll(/<script\b/gi)].length;
}

export function countBlockingHeadScripts(html: string): number {
	const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
	return [...head.matchAll(/<script\b(?![^>]*\basync\b)(?![^>]*\bdefer\b)[^>]*>/gi)].length;
}

/** Passive mixed-content hints: http:// asset URLs in HTML. */
export function hasMixedContent(html: string): boolean {
	// Only loaded resources count — <a href="http://…"> links are not mixed content.
	return /\bsrc=["']http:\/\//i.test(html) || /<link\b[^>]+href=["']http:\/\//i.test(html);
}

function pushSameOriginAssetUrl(raw: string, base: URL, urls: Set<string>): void {
	try {
		const url = new URL(raw, base);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
		if (url.origin !== base.origin) return;
		urls.add(url.href);
	} catch {
		/* skip invalid */
	}
}

/** Same-origin script and modulepreload URLs for bounded JS secret scanning. */
export function extractScriptSrcs(html: string, base: URL): string[] {
	const urls = new Set<string>();

	for (const m of html.matchAll(/<script\b[^>]+src=["']([^"']+)["']/gi)) {
		pushSameOriginAssetUrl(m[1], base, urls);
	}

	for (const m of html.matchAll(
		/<link\b[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/gi
	)) {
		pushSameOriginAssetUrl(m[1], base, urls);
	}

	for (const m of html.matchAll(
		/<link\b[^>]+href=["']([^"']+)["'][^>]+rel=["']modulepreload["']/gi
	)) {
		pushSameOriginAssetUrl(m[1], base, urls);
	}

	return [...urls];
}

/** Resolve a //# or /* sourceMappingURL comment from a fetched bundle. */
export function extractSourceMapUrl(jsText: string, scriptUrl: string): string | null {
	const match =
		jsText.match(/\/\/[#@]\s*sourceMappingURL=([^\s]+)/) ??
		jsText.match(/\/\*[#@]\s*sourceMappingURL=([^\s*]+)\s*\*\//);
	if (!match?.[1]) return null;
	try {
		return new URL(match[1], scriptUrl).href;
	} catch {
		return null;
	}
}

/** Pull original source text from a JSON source map for secret scanning. */
export function searchableSourceMapText(mapJson: string): string {
	try {
		const parsed = JSON.parse(mapJson) as {
			sources?: string[];
			sourcesContent?: (string | null)[];
		};
		const parts: string[] = [];
		for (const source of parsed.sourcesContent ?? []) {
			if (source) parts.push(source);
		}
		if (parsed.sources?.length) parts.push(...parsed.sources);
		return parts.join('\n');
	} catch {
		return '';
	}
}

export function extractLinks(html: string, base: URL): string[] {
	const links = new Set<string>();
	for (const m of html.matchAll(/<a\b[^>]+href=["']([^"'#][^"']*)["']/gi)) {
		try {
			links.add(new URL(m[1], base).href);
		} catch {
			/* skip invalid */
		}
	}
	return [...links];
}

export function linkHints(links: string[]): { privacy: boolean; terms: boolean; contact: boolean } {
	const joined = links.join('\n').toLowerCase();
	return {
		privacy: /privacy|privacy-policy|datenschutz/.test(joined),
		terms: /terms|tos|terms-of-service|terms-of-use|legal/.test(joined),
		contact: /contact|support|help/.test(joined)
	};
}

export function mentionsStack(html: string): {
	stripe: boolean;
	supabase: boolean;
	firebase: boolean;
} {
	const lower = html.toLowerCase();
	return {
		stripe: /stripe\.com|js\.stripe\.com|pk_live_|pk_test_/.test(lower),
		supabase: /supabase\.co|supabase\.in/.test(lower),
		firebase: /firebase(app)?\.com|firebaseio\.com/.test(lower)
	};
}

export const SECRET_PATTERNS: { pattern: RegExp; label: string }[] = [
	{ pattern: /sk_live_[a-zA-Z0-9]{20,}/, label: 'Stripe live secret key' },
	{ pattern: /sk_test_[a-zA-Z0-9]{20,}/, label: 'Stripe test secret key' },
	{ pattern: /sk-proj-[a-zA-Z0-9_-]{20,}/, label: 'OpenAI project secret key' },
	{ pattern: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI-style API key' },
	{ pattern: /whsec_[a-zA-Z0-9]{20,}/, label: 'Stripe webhook secret' },
	{ pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS access key' },
	{ pattern: /ghp_[a-zA-Z0-9]{20,}/, label: 'GitHub personal access token' },
	{ pattern: /gho_[a-zA-Z0-9]{20,}/, label: 'GitHub OAuth token' },
	{ pattern: /xox[baprs]-[a-zA-Z0-9-]{10,}/, label: 'Slack token' },
	{ pattern: /npm_[a-zA-Z0-9]{30,}/, label: 'npm access token' },
	{
		pattern: /discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/,
		label: 'Discord webhook URL'
	}
];

const PLACEHOLDER_VALUES =
	/^(changeme\d*|placeholder|example|your[_-]?key|xxx+|test123|secret123|password123)$/i;

export function findSecrets(html: string): string[] {
	const found: string[] = [];
	for (const { pattern, label } of SECRET_PATTERNS) {
		if (pattern.test(html)) found.push(label);
	}

	const generic =
		html.match(/(?:api[_-]?key|secret|password)\s*[:=]\s*['"]([^'"]{8,})['"]/gi) ?? [];
	for (const match of generic) {
		const value = match.split(/['"]/)[1] ?? '';
		if (!PLACEHOLDER_VALUES.test(value) && !/^x+$/i.test(value)) {
			if (!found.includes('Hardcoded secret pattern')) {
				found.push('Hardcoded secret pattern');
			}
		}
	}

	return found;
}
