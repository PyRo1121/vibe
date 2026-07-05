import type { CrawledPage } from '$lib/scan/crawl';
import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushSeoDepthChecks } from './seo-depth';

function run(html: string, opts: { finalUrl?: string; pages?: CrawledPage[] } = {}): ScanCheck[] {
	const checks: ScanCheck[] = [];
	const finalUrl = new URL(opts.finalUrl ?? 'https://app.test/');
	pushSeoDepthChecks(checks, html, finalUrl, { url: finalUrl.href }, opts.pages ?? []);
	return checks;
}

function get(checks: ScanCheck[], id: string): ScanCheck | undefined {
	return checks.find((c) => c.id === id);
}

function page(url: string, html: string | null): CrawledPage {
	return {
		role: 'privacy',
		url,
		status: html === null ? null : 200,
		html: html as unknown as string,
		wordCount: 0
	};
}

function doc(title: string, description?: string, extra = ''): string {
	const desc = description ? `<meta name="description" content="${description}">` : '';
	return `<html><head><title>${title}</title>${desc}${extra}</head><body><h1>${title}</h1><h2>Sub</h2></body></html>`;
}

describe('heading-order', () => {
	it('passes when heading levels never skip', () => {
		const checks = run('<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>');
		const check = get(checks, 'heading-order');
		expect(check?.status).toBe('pass');
	});

	it('warns on an h1 → h3 skip and names it', () => {
		const checks = run('<h1>A</h1><h3>C</h3>');
		const check = get(checks, 'heading-order');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('h1 → h3');
	});

	it('detects an h2 → h4 skip', () => {
		const checks = run('<h1>A</h1><h2>B</h2><h4>D</h4>');
		const check = get(checks, 'heading-order');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('h2 → h4');
	});

	it('ignores headings inside script tags', () => {
		const html = `<h1>A</h1><script>const t = '<h4>fake</h4>';</script><h2>B</h2>`;
		const check = get(run(html), 'heading-order');
		expect(check?.status).toBe('pass');
	});

	it('ignores headings inside svg and style blocks', () => {
		const html = `<h1>A</h1><svg><text>&lt;</text><h5>x</h5></svg><style>.h6{}</style><h2>B</h2>`;
		const check = get(run(html), 'heading-order');
		expect(check?.status).toBe('pass');
	});

	it('emits nothing with fewer than 2 headings', () => {
		expect(get(run('<h1>Only</h1><p>body</p>'), 'heading-order')).toBeUndefined();
	});
});

describe('duplicate-meta', () => {
	const home = doc('Acme', 'The best acme tools');

	it('warns when a crawled page shares identical title and description, naming the path', () => {
		const dupe = page('https://app.test/privacy', doc('Acme', 'The best acme tools'));
		const check = get(run(home, { pages: [dupe] }), 'duplicate-meta');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('identical title + description');
		expect(check?.message).toContain('/privacy');
	});

	it('passes when crawled pages have distinct titles', () => {
		const distinct = page('https://app.test/privacy', doc('Privacy — Acme', 'How we handle data'));
		const check = get(run(home, { pages: [distinct] }), 'duplicate-meta');
		expect(check?.status).toBe('pass');
		expect(check?.message).toBe('Crawled pages have distinct titles');
	});

	it('decodes entities before comparing titles', () => {
		const encodedHome = doc('A &amp; B', 'Same desc');
		const decodedPage = page('https://app.test/privacy', doc('A & B', 'Same desc'));
		const check = get(run(encodedHome, { pages: [decodedPage] }), 'duplicate-meta');
		expect(check?.status).toBe('warn');
	});

	it('skips a crawled page whose html is null', () => {
		const checks = run(home, { pages: [page('https://app.test/privacy', null)] });
		expect(get(checks, 'duplicate-meta')).toBeUndefined();
	});

	it('emits nothing with no crawled pages', () => {
		expect(get(run(home), 'duplicate-meta')).toBeUndefined();
	});
});

describe('hreflang', () => {
	it('emits nothing when no hreflang tags exist', () => {
		expect(get(run(doc('Acme')), 'hreflang')).toBeUndefined();
	});

	it('passes a single valid en-US alternate', () => {
		const html = doc(
			'Acme',
			undefined,
			'<link rel="alternate" hreflang="en-US" href="https://app.test/en">'
		);
		expect(get(run(html), 'hreflang')?.status).toBe('pass');
	});

	it('accepts en-US but warns naming an invalid code like english', () => {
		const html = doc(
			'Acme',
			undefined,
			'<link rel="alternate" hreflang="en-US" href="/en"><link rel="alternate" hreflang="english" href="/e2">'
		);
		const check = get(run(html), 'hreflang');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('english');
		expect(check?.message).not.toContain('en-US');
	});

	it('warns with "no x-default" when 3 alternates lack one', () => {
		const html = doc(
			'Acme',
			undefined,
			'<link rel="alternate" hreflang="en" href="/en"><link rel="alternate" hreflang="de" href="/de"><link rel="alternate" hreflang="fr" href="/fr">'
		);
		const check = get(run(html), 'hreflang');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('no x-default');
	});

	it('passes multiple alternates when x-default is present', () => {
		const html = doc(
			'Acme',
			undefined,
			'<link rel="alternate" hreflang="en" href="/en"><link rel="alternate" hreflang="de" href="/de"><link rel="alternate" hreflang="x-default" href="/">'
		);
		expect(get(run(html), 'hreflang')?.status).toBe('pass');
	});
});

describe('og-url-match', () => {
	it('emits nothing when og:url is absent', () => {
		expect(get(run(doc('Acme')), 'og-url-match')).toBeUndefined();
	});

	it('passes when og:url matches apart from a trailing slash', () => {
		const html = doc(
			'Acme',
			undefined,
			'<meta property="og:url" content="https://app.test/pricing/">'
		);
		const check = get(run(html, { finalUrl: 'https://app.test/pricing' }), 'og-url-match');
		expect(check?.status).toBe('pass');
	});

	it('ignores query strings and host casing', () => {
		const html = doc(
			'Acme',
			undefined,
			'<meta property="og:url" content="https://APP.TEST/?ref=home">'
		);
		expect(get(run(html), 'og-url-match')?.status).toBe('pass');
	});

	it('warns when og:url points at a different page', () => {
		const html = doc(
			'Acme',
			undefined,
			'<meta property="og:url" content="https://elsewhere.test/page">'
		);
		const check = get(run(html), 'og-url-match');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('og:url points to https://elsewhere.test/page');
		expect(check?.message).toContain('https://app.test/');
	});
});

describe('meta-keywords', () => {
	it('warns when a meta keywords tag exists', () => {
		const html = doc('Acme', undefined, '<meta name="keywords" content="acme, tools, best">');
		const check = get(run(html), 'meta-keywords');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('obsolete');
	});

	it('emits nothing when absent', () => {
		expect(get(run(doc('Acme')), 'meta-keywords')).toBeUndefined();
	});
});

describe('title-brand-dupe', () => {
	it('flags "Acme — Acme"', () => {
		const check = get(run(doc('Acme — Acme')), 'title-brand-dupe');
		expect(check?.status).toBe('warn');
	});

	it('flags pipe-separated duplicates case-insensitively', () => {
		expect(get(run(doc('Acme | acme')), 'title-brand-dupe')?.status).toBe('warn');
	});

	it('emits nothing for a normal separated title', () => {
		expect(get(run(doc('Acme — Launch checker')), 'title-brand-dupe')).toBeUndefined();
	});

	it('emits nothing when there is no title', () => {
		expect(
			get(run('<html><head></head><body><h1>A</h1></body></html>'), 'title-brand-dupe')
		).toBeUndefined();
	});
});

describe('pushSeoDepthChecks', () => {
	it('emits all six checks on a messy page and never uses fail', () => {
		const messy = [
			'<html><head><title>Acme | Acme</title>',
			'<meta name="description" content="Same desc">',
			'<meta name="keywords" content="a,b">',
			'<meta property="og:url" content="https://elsewhere.test/page">',
			'<link rel="alternate" hreflang="english" href="/en">',
			'</head><body><h1>A</h1><h4>D</h4></body></html>'
		].join('');
		const checks = run(messy, { pages: [page('https://app.test/privacy', messy)] });
		expect(checks).toHaveLength(6);
		for (const check of checks) {
			expect(['pass', 'warn']).toContain(check.status);
			expect(check.category).toBe('seo');
			expect(check.fixPrompt).toBeTruthy();
		}
	});
});
