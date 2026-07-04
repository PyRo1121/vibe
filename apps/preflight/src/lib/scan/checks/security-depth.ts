import type { ScanCheck } from '$lib/scan/types';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';

function attr(tag: string, name: string): string | null {
	const re = new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`, 'i');
	return tag.match(re)?.[2] ?? null;
}

function stripBlocks(html: string): string {
	return html.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
}

function resolveUrl(href: string, base: URL): URL | null {
	try {
		return new URL(href, base);
	} catch {
		return null;
	}
}

function isDifferentOrigin(href: string, finalUrl: URL): boolean {
	const resolved = resolveUrl(href, finalUrl);
	if (!resolved) return false;
	if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return false;
	return resolved.origin.toLowerCase() !== finalUrl.origin.toLowerCase();
}

function pushFormSecurityCheck(
	checks: ScanCheck[],
	html: string,
	finalUrl: URL,
	ctx: { url: string }
): void {
	const scan = stripBlocks(html);
	const forms = [...scan.matchAll(/<form\b[^>]*>/gi)].map((m) => m[0]);
	const hasPassword = /<input\b[^>]*\btype\s*=\s*(["'])password\1/i.test(scan);

	if (forms.length === 0 && !hasPassword) return;

	if (finalUrl.protocol === 'http:' && hasPassword) {
		checks.push(
			makeCheck(
				'form-security',
				'security',
				'Form transport security',
				'fail',
				'Password field on an HTTP page — credentials would transit unencrypted',
				fixPrompt('form-security', ctx)
			)
		);
		return;
	}

	if (finalUrl.protocol === 'https:') {
		for (const form of forms) {
			const action = attr(form, 'action');
			if (action === null || action === '') continue;
			const resolved = resolveUrl(action, finalUrl);
			if (resolved?.protocol === 'http:') {
				checks.push(
					makeCheck(
						'form-security',
						'security',
						'Form transport security',
						'fail',
						`Form posts to http://${resolved.host} over plain HTTP — credentials/PII would transit unencrypted`,
						fixPrompt('form-security', ctx)
					)
				);
				return;
			}
		}
	}

	if (forms.length > 0) {
		checks.push(
			makeCheck(
				'form-security',
				'security',
				'Form transport security',
				'pass',
				`${forms.length} form${forms.length === 1 ? '' : 's'} post over HTTPS`,
				fixPrompt('form-security', ctx)
			)
		);
	}
}

function pushSriCheck(
	checks: ScanCheck[],
	html: string,
	finalUrl: URL,
	ctx: { url: string }
): void {
	const thirdParty: { hasIntegrity: boolean }[] = [];

	for (const m of html.matchAll(/<script\b[^>]*>/gi)) {
		const tag = m[0];
		const src = attr(tag, 'src');
		if (!src) continue;
		if (!isDifferentOrigin(src, finalUrl)) continue;
		thirdParty.push({ hasIntegrity: /\bintegrity\s*=/i.test(tag) });
	}

	if (thirdParty.length === 0) return;

	const withSri = thirdParty.filter((s) => s.hasIntegrity).length;
	const withoutSri = thirdParty.length - withSri;

	if (thirdParty.length >= 3 && withSri === 0) {
		checks.push(
			makeCheck(
				'sri',
				'security',
				'Subresource Integrity',
				'warn',
				`${withoutSri} third-party scripts load without Subresource Integrity — a compromised CDN executes arbitrary code on your page (see polyfill.io 2024)`,
				fixPrompt('sri', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'sri',
			'security',
			'Subresource Integrity',
			'pass',
			`Third-party scripts: ${thirdParty.length}, ${withSri} with SRI`,
			fixPrompt('sri', ctx)
		)
	);
}

function relTokens(rel: string | null): string[] {
	if (!rel) return [];
	return rel.toLowerCase().split(/\s+/).filter(Boolean);
}

function pushNoopenerCheck(
	checks: ScanCheck[],
	html: string,
	finalUrl: URL,
	ctx: { url: string }
): void {
	const scan = stripBlocks(html);
	let unsafe = 0;
	let blankTotal = 0;
	let hasExternalUnsafe = false;

	for (const m of scan.matchAll(/<a\b[^>]*>/gi)) {
		const tag = m[0];
		const target = (attr(tag, 'target') ?? '').toLowerCase();
		if (target !== '_blank') continue;

		blankTotal++;
		const tokens = relTokens(attr(tag, 'rel'));
		if (tokens.includes('noopener') || tokens.includes('noreferrer')) continue;

		unsafe++;
		const href = attr(tag, 'href');
		if (href && isDifferentOrigin(href, finalUrl)) hasExternalUnsafe = true;
	}

	if (blankTotal === 0) return;

	if (unsafe >= 3 && hasExternalUnsafe) {
		checks.push(
			makeCheck(
				'noopener',
				'security',
				'Tabnabbing protection',
				'warn',
				`${unsafe} external target=_blank links without rel=noopener — older browsers let the target page hijack yours via window.opener`,
				fixPrompt('noopener', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'noopener',
			'security',
			'Tabnabbing protection',
			'pass',
			'target=_blank links carry rel=noopener',
			fixPrompt('noopener', ctx)
		)
	);
}

function isWordPress(html: string): boolean {
	return /wp-content\/|wp-includes\//i.test(html);
}

function pushWpExposureCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	if (!isWordPress(html)) return;

	const hasXmlrpc = /xmlrpc\.php/i.test(html);
	const hasVersion = /<meta\b[^>]*\bname\s*=\s*(["'])generator\1[^>]*\bcontent\s*=\s*(["'])WordPress\s+\d+\.\d+/i.test(
		html
	);

	if (hasXmlrpc || hasVersion) {
		checks.push(
			makeCheck(
				'wp-exposure',
				'security',
				'WordPress exposure',
				'warn',
				'WordPress version/xmlrpc exposed — attackers fingerprint known CVEs; hide the generator tag and disable xmlrpc',
				fixPrompt('wp-exposure', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'wp-exposure',
			'security',
			'WordPress exposure',
			'pass',
			'WordPress detected, no version/xmlrpc exposure',
			fixPrompt('wp-exposure', ctx)
		)
	);
}

const PLACEHOLDER_EMAIL_DOMAINS = /^(example\.com|yourdomain\.com|sentry\.io|wixpress\.com)$/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/gi;

function isPlaceholderEmail(email: string): boolean {
	const domain = email.split('@')[1]?.toLowerCase() ?? '';
	if (PLACEHOLDER_EMAIL_DOMAINS.test(domain)) return true;
	if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(domain)) return true;
	return false;
}

function collectEmails(html: string): Set<string> {
	const scan = stripBlocks(html);
	const emails = new Set<string>();

	for (const m of scan.matchAll(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,})/gi)) {
		const email = m[1].toLowerCase();
		if (!isPlaceholderEmail(email)) emails.add(email);
	}

	for (const m of scan.matchAll(EMAIL_RE)) {
		const email = m[0].toLowerCase();
		if (!isPlaceholderEmail(email)) emails.add(email);
	}

	return emails;
}

function pushMailtoExposureCheck(checks: ScanCheck[], html: string, ctx: { url: string }): void {
	const emails = collectEmails(html);
	if (emails.size === 0) return;

	if (emails.size >= 3) {
		checks.push(
			makeCheck(
				'mailto-exposure',
				'security',
				'Email address exposure',
				'warn',
				`${emails.size} email addresses in page source — harvesters scrape these for spam; consider a contact form or obfuscation`,
				fixPrompt('mailto-exposure', ctx)
			)
		);
		return;
	}

	checks.push(
		makeCheck(
			'mailto-exposure',
			'security',
			'Email address exposure',
			'pass',
			'Contact email visible (fine — just know scrapers see it too)',
			fixPrompt('mailto-exposure', ctx)
		)
	);
}

export function pushSecurityDepthChecks(
	checks: ScanCheck[],
	html: string,
	finalUrl: URL,
	ctx: { url: string }
): void {
	pushFormSecurityCheck(checks, html, finalUrl, ctx);
	pushSriCheck(checks, html, finalUrl, ctx);
	pushNoopenerCheck(checks, html, finalUrl, ctx);
	pushWpExposureCheck(checks, html, ctx);
	pushMailtoExposureCheck(checks, html, ctx);
}
