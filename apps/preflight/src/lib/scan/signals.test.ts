import { describe, expect, it } from 'vitest';
import {
	detectAnalytics,
	detectConsentTool,
	findPlaceholderHints,
	hasCookieBasedAnalytics,
	hasJsonLd,
	isImageContentType,
	llmsTxtLooksValid,
	robotsBlocksAllCrawlers,
	securityTxtLooksValid
} from './signals';

describe('findPlaceholderHints subpage context', () => {
	it('skips example.com on legal sub-pages but keeps it on the homepage', () => {
		const html = '<p>We may set cookies when you visit example.com or any site.</p>';
		expect(findPlaceholderHints(html, 'subpage')).toEqual([]);
		expect(findPlaceholderHints(html, 'home').map((h) => h.label)).toContain(
			'example.com placeholder domain'
		);
	});

	it('still flags lorem ipsum on sub-pages', () => {
		const html = '<p>Lorem ipsum dolor sit amet.</p>';
		expect(findPlaceholderHints(html, 'subpage').map((h) => h.label)).toContain(
			'Lorem ipsum placeholder text'
		);
	});
});

describe('detectConsentTool', () => {
	it('detects common consent managers', () => {
		expect(detectConsentTool('<script src="https://consent.cookiebot.com/uc.js"></script>')).toBe(
			'Cookiebot'
		);
		expect(
			detectConsentTool('<script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js">')
		).toBe('OneTrust');
		expect(detectConsentTool('<script src="/js/cookieconsent.min.js"></script>')).toBe(
			'CookieConsent'
		);
	});

	it('returns null when nothing matches', () => {
		expect(detectConsentTool('<html><body>plain page</body></html>')).toBeNull();
	});
});

describe('hasCookieBasedAnalytics', () => {
	it('treats GA4/GTM/PostHog as cookie-based but not Plausible/Fathom', () => {
		expect(hasCookieBasedAnalytics(['ga4'])).toBe(true);
		expect(hasCookieBasedAnalytics(['gtm'])).toBe(true);
		expect(hasCookieBasedAnalytics(['posthog'])).toBe(true);
		expect(hasCookieBasedAnalytics(['plausible', 'fathom'])).toBe(false);
		expect(hasCookieBasedAnalytics([])).toBe(false);
	});
});

describe('findPlaceholderHints', () => {
	it('detects lorem ipsum and TODO', () => {
		const html = '<body><p>Lorem ipsum dolor sit amet</p><span>TODO: fix hero</span></body>';
		const hits = findPlaceholderHints(html);
		expect(hits.some((h) => h.label.includes('Lorem'))).toBe(true);
		expect(hits.some((h) => h.label.includes('TODO'))).toBe(true);
	});

	it('ignores placeholders inside scripts', () => {
		const html = '<script>const x = "TODO in code";</script><p>Real product copy here.</p>';
		expect(findPlaceholderHints(html)).toHaveLength(0);
	});
});

describe('robotsBlocksAllCrawlers', () => {
	it('flags site-wide disallow', () => {
		const text = `User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /`;
		expect(robotsBlocksAllCrawlers(text)).toBe(true);
	});

	it('passes when only partial paths blocked', () => {
		const text = `User-agent: *\nDisallow: /admin\nAllow: /`;
		expect(robotsBlocksAllCrawlers(text)).toBe(false);
	});
});

describe('llmsTxtLooksValid', () => {
	it('accepts non-trivial markdown', () => {
		expect(llmsTxtLooksValid('# My App\n\nDocs for AI crawlers.\n')).toBe(true);
	});

	it('rejects HTML error pages', () => {
		expect(llmsTxtLooksValid('<!DOCTYPE html><html></html>')).toBe(false);
	});
});

describe('securityTxtLooksValid', () => {
	it('accepts RFC 9116 contact line', () => {
		expect(securityTxtLooksValid('Contact: mailto:security@example.com\n')).toBe(true);
	});

	it('rejects HTML error pages', () => {
		expect(securityTxtLooksValid('<html><body>404</body></html>')).toBe(false);
	});
});

describe('hasJsonLd', () => {
	it('detects JSON-LD script tags', () => {
		const html = '<script type="application/ld+json">{"@type":"WebSite"}</script>';
		expect(hasJsonLd(html)).toBe(true);
	});
});

describe('detectAnalytics', () => {
	it('finds plausible and gtm', () => {
		const html =
			'<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABC"></script>' +
			'<script defer data-domain="app.test" src="https://plausible.io/js/script.js"></script>';
		const stacks = detectAnalytics(html);
		expect(stacks).toContain('gtm');
		expect(stacks).toContain('plausible');
	});

	it('finds ga4 from a real measurement ID', () => {
		expect(detectAnalytics('gtag("config", "G-ABC123XYZ0")')).toContain('ga4');
		expect(detectAnalytics('<script>window.G_TAG="G-1A2B3C4D5E"</script>')).toContain('ga4');
	});

	it('does not false-match lowercase CSS classes as GA4 IDs', () => {
		expect(detectAnalytics('<div class="bg-indigo-500 text-g-indigo">x</div>')).toEqual([]);
		expect(detectAnalytics('<p>g-abcdef12 is not analytics</p>')).toEqual([]);
	});
});

describe('isImageContentType', () => {
	it('accepts image/*', () => {
		expect(isImageContentType('image/png')).toBe(true);
	});

	it('rejects HTML masquerading as og:image', () => {
		expect(isImageContentType('text/html; charset=utf-8')).toBe(false);
	});
});
