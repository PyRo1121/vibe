import { describe, expect, it } from 'vitest';
import {
	extractLinks,
	extractScriptSrcs,
	findSecrets,
	countH1s,
	hasFavicon,
	hasH1,
	hasMixedContent,
	hasRobotsNoindex,
	hasViewport,
	htmlLang,
	linkHints,
	normalizeUrl,
	pickCanonical,
	pickMeta,
	pickTitle,
	countBlockingHeadScripts,
	countScriptTags
} from './parse';

describe('normalizeUrl', () => {
	it('adds https when protocol missing', () => {
		expect(normalizeUrl('example.com').href).toBe('https://example.com/');
	});

	it('preserves explicit https', () => {
		expect(normalizeUrl('https://app.io/path').href).toBe('https://app.io/path');
	});

	it('trims whitespace', () => {
		expect(normalizeUrl('  https://x.com  ').href).toBe('https://x.com/');
	});
});

describe('pickTitle', () => {
	it('extracts title text', () => {
		const html = '<html><head><title>My SaaS App</title></head></html>';
		expect(pickTitle(html)).toBe('My SaaS App');
	});

	it('returns null when missing', () => {
		expect(pickTitle('<html></html>')).toBeNull();
	});
});

describe('pickMeta', () => {
	it('reads name=description', () => {
		const html = '<meta name="description" content="Ship faster with AI">';
		expect(pickMeta(html, 'description')).toBe('Ship faster with AI');
	});

	it('reads property=og:title', () => {
		const html = '<meta property="og:title" content="Launch">';
		expect(pickMeta(html, 'og:title')).toBe('Launch');
	});
});

describe('hasViewport', () => {
	it('detects viewport meta', () => {
		expect(hasViewport('<meta name="viewport" content="width=device-width">')).toBe(true);
		expect(hasViewport('<html></html>')).toBe(false);
	});
});

describe('htmlLang', () => {
	it('reads lang attribute', () => {
		expect(htmlLang('<html lang="en">')).toBe('en');
	});
});

describe('hasH1', () => {
	it('detects h1 tag', () => {
		expect(hasH1('<body><h1>Hello</h1></body>')).toBe(true);
		expect(hasH1('<body><h2>Hello</h2></body>')).toBe(false);
	});
});

describe('countH1s', () => {
	it('counts h1 tags', () => {
		expect(countH1s('<h1>One</h1>')).toBe(1);
		expect(countH1s('<h1>One</h1><h1 class="x">Two</h1>')).toBe(2);
		expect(countH1s('<h2>None</h2>')).toBe(0);
	});
});

describe('extractLinks + linkHints', () => {
	it('resolves relative links and detects legal pages', () => {
		const base = new URL('https://app.test/');
		const html = `
			<a href="/privacy">Privacy</a>
			<a href="/terms-of-service">Terms</a>
			<a href="mailto:support@app.test">Support</a>
		`;
		const links = extractLinks(html, base);
		const hints = linkHints(links);
		expect(hints.privacy).toBe(true);
		expect(hints.terms).toBe(true);
		expect(hints.contact).toBe(true);
	});
});

describe('hasMixedContent', () => {
	it('detects http asset urls', () => {
		expect(hasMixedContent('<img src="http://cdn.test/x.png">')).toBe(true);
		expect(hasMixedContent('<img src="https://cdn.test/x.png">')).toBe(false);
		expect(hasMixedContent('<link rel="stylesheet" href="http://cdn.test/a.css">')).toBe(true);
	});

	it('ignores plain anchor links — navigation is not mixed content', () => {
		expect(hasMixedContent('<a href="http://example.org/blog">old blog</a>')).toBe(false);
	});
});

describe('hasFavicon', () => {
	it('detects favicon link', () => {
		expect(hasFavicon('<link rel="icon" href="/f.ico">')).toBe(true);
		expect(hasFavicon('<html></html>')).toBe(false);
	});
});

describe('launch meta helpers', () => {
	it('detects noindex and canonical', () => {
		expect(hasRobotsNoindex('<meta name="robots" content="noindex,nofollow">')).toBe(true);
		expect(pickCanonical('<link rel="canonical" href="https://app.test/">')).toBe(
			'https://app.test/'
		);
	});

	it('counts scripts and blocking head scripts', () => {
		const html = `<head><script src="/a.js"></script><script defer src="/b.js"></script></head><script>inline</script>`;
		expect(countScriptTags(html)).toBe(3);
		expect(countBlockingHeadScripts(html)).toBe(1);
	});
});

describe('extractScriptSrcs', () => {
	it('collects same-origin script and modulepreload URLs', () => {
		const base = new URL('https://app.test/page');
		const html = `
			<script src="/app.js"></script>
			<script src="https://cdn.other.com/evil.js"></script>
			<link rel="modulepreload" href="/chunks/main.js">
			<link href="/chunks/vendor.js" rel="modulepreload">
		`;
		expect(extractScriptSrcs(html, base)).toEqual([
			'https://app.test/app.js',
			'https://app.test/chunks/main.js',
			'https://app.test/chunks/vendor.js'
		]);
	});
});

describe('findSecrets', () => {
	it('flags stripe live keys', () => {
		const html = '<script>const x = "sk_live_1234567890123456789012";</script>';
		expect(findSecrets(html)).toContain('Stripe live secret key');
	});

	it('returns empty for clean html', () => {
		expect(findSecrets('<html><body>ok</body></html>')).toEqual([]);
	});

	it('ignores placeholder tutorial values', () => {
		const html = '<code>password = "changeme123"</code>';
		expect(findSecrets(html)).toEqual([]);
	});
});
