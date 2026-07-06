import type { LinkCheckResult, ScanContext } from '$lib/scan/checks/context';
import type { CrawledPage } from '$lib/scan/crawl';
import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushCompetitiveChecks, sitemapCheck } from './competitive';

const CTX = { url: 'https://app.test/' };

function baseLinkResult(overrides: Partial<LinkCheckResult> = {}): LinkCheckResult {
	return {
		brokenCount: 0,
		checkedCount: 0,
		robotsOk: true,
		sitemapOk: false,
		llmsTxtOk: false,
		securityTxtOk: false,
		robotsText: 'User-agent: *\nAllow: /',
		sitemapLocs: [],
		...overrides
	};
}

function baseScanContext(overrides: Partial<ScanContext> = {}): ScanContext {
	return {
		redirectHops: 0,
		ogImage: { reachable: null, isImage: null, contentType: null },
		robotsText: 'User-agent: *\nAllow: /',
		...overrides
	};
}

function run(
	html: string,
	opts: {
		link?: Partial<LinkCheckResult>;
		scan?: Partial<ScanContext>;
		ogImageOk?: boolean | null;
		pages?: CrawledPage[];
	} = {}
): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushCompetitiveChecks(
		checks,
		html,
		CTX,
		baseLinkResult(opts.link),
		baseScanContext(opts.scan),
		opts.ogImageOk ?? null,
		opts.pages ?? []
	);
	return checks;
}

function get(checks: ScanCheck[], id: string): ScanCheck | undefined {
	return checks.find((check) => check.id === id);
}

describe('pushCompetitiveChecks', () => {
	it('reports sitemap reachability and sampled URL health', () => {
		expect(sitemapCheck(false, null, CTX)).toMatchObject({
			id: 'sitemap',
			status: 'warn'
		});
		expect(sitemapCheck(true, { checked: 4, broken: 0 }, CTX)).toMatchObject({
			status: 'pass'
		});
		expect(sitemapCheck(true, { checked: 4, broken: 0 }, CTX).message).toContain(
			'4 sampled URL(s) reachable'
		);
		const broken = sitemapCheck(true, { checked: 4, broken: 2 }, CTX);
		expect(broken).toMatchObject({ status: 'warn' });
		expect(broken.message).toContain('2 of 4 sampled failed');
	});

	it('fails placeholder-copy on home and crawled subpage template leftovers', () => {
		const page: CrawledPage = {
			url: 'https://app.test/pricing',
			role: 'pricing',
			status: 200,
			html: '<main><p>Lorem ipsum package copy.</p></main>',
			wordCount: 4
		};
		const checks = run('<main><p>Contact us at demo@example.com</p></main>', { pages: [page] });

		const placeholder = get(checks, 'placeholder-copy');

		expect(placeholder).toMatchObject({ status: 'fail' });
		expect(placeholder?.message).toContain('Placeholder email address');
		expect(placeholder?.message).toContain('Lorem ipsum placeholder text (on /pricing)');
	});

	it('passes placeholder-copy while noting multi-page sampling depth', () => {
		const checks = run('<main><p>Production copy.</p></main>', {
			pages: [
				{
					url: 'https://app.test/about',
					role: 'sitemap',
					status: 200,
					html: '<main><p>Real team copy.</p></main>',
					wordCount: 4
				}
			]
		});

		const placeholder = get(checks, 'placeholder-copy');

		expect(placeholder).toMatchObject({ status: 'pass' });
		expect(placeholder?.message).toContain('across 2 pages');
	});

	it('scores analytics and cookie consent by tracker type', () => {
		const none = run('<html></html>');
		const plausible = run('<script src="https://plausible.io/js/script.js"></script>');
		const gaNoConsent = run(
			'<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABCDEFGH"></script>'
		);
		const gaWithConsent = run(
			'<script src="https://consent.cookiebot.com/uc.js"></script><script>gtag("config","G-ABCDEFGH")</script>'
		);

		expect(get(none, 'analytics')).toMatchObject({ status: 'warn' });
		expect(get(none, 'cookie-consent')).toMatchObject({ status: 'pass' });
		expect(get(plausible, 'analytics')).toMatchObject({ status: 'pass' });
		expect(get(plausible, 'cookie-consent')?.message).toContain('not required');
		expect(get(gaNoConsent, 'cookie-consent')).toMatchObject({ status: 'warn' });
		expect(get(gaNoConsent, 'cookie-consent')?.message).toContain('GDPR');
		expect(get(gaWithConsent, 'cookie-consent')).toMatchObject({ status: 'pass' });
		expect(get(gaWithConsent, 'cookie-consent')?.message).toContain('Cookiebot');
	});

	it('passes json-ld when structured data is present and warns when absent', () => {
		const withJsonLd = run(
			'<script type="application/ld+json">{"@type":"WebSite","name":"Acme"}</script>'
		);
		const withoutJsonLd = run('<html><body>Acme</body></html>');

		expect(get(withJsonLd, 'json-ld')?.status).toBe('pass');
		expect(get(withoutJsonLd, 'json-ld')?.status).toBe('warn');
	});

	it('reports llms-txt and security-txt reachability signals', () => {
		const checks = run('<html></html>', {
			link: { llmsTxtOk: true, securityTxtOk: true }
		});

		expect(get(checks, 'llms-txt')?.status).toBe('pass');
		expect(get(checks, 'security-txt')?.status).toBe('pass');
	});

	it('warns when llms.txt and security.txt are missing', () => {
		const checks = run('<html></html>');

		expect(get(checks, 'llms-txt')).toMatchObject({ status: 'warn' });
		expect(get(checks, 'security-txt')).toMatchObject({ status: 'warn' });
	});

	it('fails robots-block when robots.txt blocks the whole site', () => {
		const robotsText = 'User-agent: *\nDisallow: /';
		const checks = run('<html></html>', {
			link: { robotsOk: true, robotsText },
			scan: { robotsText }
		});

		expect(get(checks, 'robots-block')?.status).toBe('fail');
	});

	it('passes robots-block when robots.txt is fetched and allows crawling', () => {
		const robotsText = 'User-agent: *\nAllow: /';
		const checks = run('<html></html>', {
			link: { robotsOk: true, robotsText },
			scan: { robotsText }
		});

		expect(get(checks, 'robots-block')).toMatchObject({ status: 'pass' });
	});

	it('warns and fails redirect-chain based on hop count', () => {
		const warn = run('<html></html>', { scan: { redirectHops: 2 } });
		const fail = run('<html></html>', { scan: { redirectHops: 4 } });

		expect(get(warn, 'redirect-chain')?.status).toBe('warn');
		expect(get(fail, 'redirect-chain')?.status).toBe('fail');
	});

	it('emits og-image-type for non-image and valid image probe outcomes', () => {
		const bad = run('<html></html>', {
			scan: { ogImage: { reachable: true, isImage: false, contentType: 'text/html' } }
		});
		const good = run('<html></html>', {
			ogImageOk: true,
			scan: { ogImage: { reachable: true, isImage: true, contentType: 'image/png' } }
		});

		expect(get(bad, 'og-image-type')?.status).toBe('fail');
		expect(get(good, 'og-image-type')?.status).toBe('pass');
	});
});
