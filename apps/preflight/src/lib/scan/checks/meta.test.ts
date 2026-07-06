import type { CrawledPage } from '$lib/scan/crawl';
import type { PageMeta } from '$lib/scan/parse';
import { parsePageMeta } from '$lib/scan/parse';
import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushMetaChecks } from './meta';

const checkCtx = { url: 'https://app.test/' };

function emptyMeta(overrides: Partial<PageMeta> = {}): PageMeta {
	return {
		...parsePageMeta('<html></html>', new URL(checkCtx.url), []),
		...overrides
	};
}

function run(html: string, meta = emptyMeta(), crawledPages: CrawledPage[] = []): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushMetaChecks(checks, html, meta, checkCtx, crawledPages);
	return checks;
}

describe('pushMetaChecks', () => {
	it('fails privacy when no policy link', () => {
		const privacy = run('<html><body><p>Hello</p></body></html>').find((c) => c.id === 'privacy');
		expect(privacy?.status).toBe('fail');
	});

	it('warns when contact is missing and passes when a contact path exists', () => {
		const missing = run('<html><body><p>Hello</p></body></html>').find((c) => c.id === 'contact');
		const present = run(
			'<html><body><a href="/contact">Contact support</a></body></html>',
			emptyMeta({ legal: { privacy: false, terms: false, contact: true } })
		).find((c) => c.id === 'contact');

		expect(missing?.status).toBe('warn');
		expect(present?.status).toBe('pass');
	});

	it('passes title when present', () => {
		const title = run(
			'<html></html>',
			emptyMeta({ resolvedTitle: 'My Product', title: 'My Product' })
		).find((c) => c.id === 'title');
		expect(title?.status).toBe('pass');
	});

	it('scores basic mobile, favicon, language, H1, and viewport metadata', () => {
		const missing = run('<html></html>');
		const present = run(
			'<html></html>',
			emptyMeta({
				favicon: true,
				appleTouchIcon: true,
				viewport: true,
				lang: 'en',
				h1Count: 1
			})
		);
		const multipleH1 = run('<html></html>', emptyMeta({ h1Count: 2 })).find((c) => c.id === 'h1');

		expect(missing.find((c) => c.id === 'favicon')).toMatchObject({ status: 'warn' });
		expect(missing.find((c) => c.id === 'apple-touch-icon')).toMatchObject({ status: 'warn' });
		expect(missing.find((c) => c.id === 'viewport')).toMatchObject({ status: 'fail' });
		expect(missing.find((c) => c.id === 'lang')).toMatchObject({ status: 'warn' });
		expect(present.find((c) => c.id === 'favicon')).toMatchObject({ status: 'pass' });
		expect(present.find((c) => c.id === 'apple-touch-icon')).toMatchObject({ status: 'pass' });
		expect(present.find((c) => c.id === 'viewport')).toMatchObject({ status: 'pass' });
		expect(present.find((c) => c.id === 'lang')?.message).toBe('lang="en"');
		expect(present.find((c) => c.id === 'h1')).toMatchObject({ status: 'pass' });
		expect(multipleH1).toMatchObject({ status: 'warn' });
		expect(multipleH1?.message).toContain('2 H1s found');
	});

	it('scores Open Graph tags across missing, partial, and complete metadata', () => {
		const missing = run('<html></html>').find((c) => c.id === 'open-graph');
		const partial = run(
			'<html></html>',
			emptyMeta({ ogTitle: 'Acme', ogDescription: 'Ship safer' })
		).find((c) => c.id === 'open-graph');
		const complete = run(
			'<html></html>',
			emptyMeta({
				ogTitle: 'Acme',
				ogDescription: 'Ship safer',
				ogImage: 'https://app.test/og.png'
			})
		).find((c) => c.id === 'open-graph');

		expect(missing?.status).toBe('fail');
		expect(partial?.status).toBe('warn');
		expect(complete?.status).toBe('pass');
	});

	it('scores landing-page clarity from title, description, and H1 quality', () => {
		const missing = run(
			'<html></html>',
			emptyMeta({ title: null, description: null, h1: false })
		).find((c) => c.id === 'clarity');
		const vague = run(
			'<html></html>',
			emptyMeta({ title: 'Home', description: 'Welcome', h1: true })
		).find((c) => c.id === 'clarity');
		const clear = run(
			'<html></html>',
			emptyMeta({
				title: 'Deploylint - Launch readiness scanner',
				description: 'Audit SEO, security, payments, and production readiness before launch.',
				h1: true
			})
		).find((c) => c.id === 'clarity');

		expect(missing?.status).toBe('fail');
		expect(vague?.status).toBe('warn');
		expect(clear?.status).toBe('pass');
	});

	it('warns when the page omits charset-meta and passes when UTF-8 is declared', () => {
		const missing = run('<html><head></head><body></body></html>').find(
			(c) => c.id === 'charset-meta'
		);
		const present = run('<html><head><meta charset="utf-8"></head><body></body></html>').find(
			(c) => c.id === 'charset-meta'
		);

		expect(missing?.status).toBe('warn');
		expect(present?.status).toBe('pass');
	});

	it('reports img-alt status from parsed missing alt counts', () => {
		const imgAlt = run('<html></html>', emptyMeta({ missingAlts: 2 })).find(
			(c) => c.id === 'img-alt'
		);

		expect(imgAlt?.status).toBe('warn');
		expect(imgAlt?.message).toContain('2 image(s) missing alt');
	});

	it('verifies crawled legal pages instead of trusting links alone', () => {
		const linkedMeta = emptyMeta({
			legal: { privacy: true, terms: true, contact: false }
		});
		const fullPrivacy = {
			role: 'privacy' as const,
			url: 'https://app.test/privacy',
			status: 200,
			html: '<main>Privacy policy</main>',
			wordCount: 120
		};
		const stubTerms = {
			role: 'terms' as const,
			url: 'https://app.test/terms',
			status: 200,
			html: '<main>Terms</main>',
			wordCount: 6
		};

		const checks = run('<html></html>', linkedMeta, [fullPrivacy, stubTerms]);

		expect(checks.find((c) => c.id === 'privacy')).toMatchObject({ status: 'pass' });
		expect(checks.find((c) => c.id === 'privacy')?.message).toContain('Verified /privacy');
		expect(checks.find((c) => c.id === 'privacy')?.message).toContain('120 words');
		expect(checks.find((c) => c.id === 'terms')).toMatchObject({ status: 'warn' });
		expect(checks.find((c) => c.id === 'terms')?.message).toContain('looks like a stub');
	});

	it('fails missing crawled legal pages and warns on unverifiable legal pages', () => {
		const linkedMeta = emptyMeta({
			legal: { privacy: true, terms: true, contact: false }
		});
		const missingPrivacy = {
			role: 'privacy' as const,
			url: 'https://app.test/privacy',
			status: 404,
			html: '',
			wordCount: 0
		};
		const unavailableTerms = {
			role: 'terms' as const,
			url: 'https://app.test/terms',
			status: null,
			html: '',
			wordCount: 0
		};

		const checks = run('<html></html>', linkedMeta, [missingPrivacy, unavailableTerms]);

		expect(checks.find((c) => c.id === 'privacy')).toMatchObject({ status: 'fail' });
		expect(checks.find((c) => c.id === 'privacy')?.message).toContain('HTTP 404');
		expect(checks.find((c) => c.id === 'terms')).toMatchObject({ status: 'warn' });
		expect(checks.find((c) => c.id === 'terms')?.message).toContain('could not verify');
	});
});
