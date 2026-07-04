import { describe, expect, it } from 'vitest';
import { extractSitemapLocs, scanUrl } from './engine';
import { GOOD_HTML } from '$lib/test/fixtures/good-html';
import { LEGAL_PAGE_HTML, STUB_PAGE_HTML } from '$lib/test/fixtures/legal-html';
import { STRONG_HEADERS } from '$lib/test/fixtures/scan-headers';

const mockDeps = {
	headOk: async () => true,
	headProbe: async () => ({ reachable: true, isImage: true, contentType: 'image/png' }),
	fetchText: async () => null
};

/** Serves different HTML per path; unknown paths fall back to '/'. The 404-probe path gets a real 404. */
function routedFetchHtml(routes: Record<string, { html: string; status?: number }>) {
	return async (url: URL) => {
		if (url.pathname.startsWith('/preflight-missing-')) {
			return { html: 'not found', finalUrl: url, status: 404, headers: STRONG_HEADERS, redirectHops: 0 };
		}
		const route = routes[url.pathname] ?? routes['/'];
		return {
			html: route.html,
			finalUrl: url,
			status: route.status ?? 200,
			headers: STRONG_HEADERS,
			redirectHops: 0
		};
	};
}

const LEGAL_ROUTES = {
	'/': { html: GOOD_HTML },
	'/privacy': { html: LEGAL_PAGE_HTML },
	'/terms': { html: LEGAL_PAGE_HTML }
};

describe('extractSitemapLocs', () => {
	const origin = new URL('https://app.test/');

	it('extracts same-origin locs up to the cap', () => {
		const xml =
			'<urlset>' +
			['a', 'b', 'c', 'd'].map((p) => `<url><loc>https://app.test/${p}</loc></url>`).join('') +
			'</urlset>';
		expect(extractSitemapLocs(xml, origin)).toEqual([
			'https://app.test/a',
			'https://app.test/b',
			'https://app.test/c'
		]);
	});

	it('skips cross-origin and malformed entries and decodes &amp;', () => {
		const xml =
			'<urlset><url><loc>https://evil.test/x</loc></url><url><loc>not a url</loc></url><url><loc>https://app.test/p?a=1&amp;b=2</loc></url></urlset>';
		expect(extractSitemapLocs(xml, origin)).toEqual(['https://app.test/p?a=1&b=2']);
	});
});

describe('scanUrl', () => {
	it('returns fetch failure check when HTML fetch throws', async () => {
		const report = await scanUrl('https://down.test', {
			fetchHtml: async () => {
				throw new Error('network error');
			},
			...mockDeps
		});
		expect(report.checks).toHaveLength(1);
		expect(report.checks[0].id).toBe('fetch');
		expect(report.checks[0].status).toBe('fail');
		expect(report.scanCoverage).toBe('blocked');
		expect(report.verdictMessage).toContain('Scan incomplete');
	});

	it('runs full checklist with injected deps', async () => {
		const report = await scanUrl('app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps
		});
		expect(report.finalUrl).toBe('https://app.test/');
		expect(report.score).toBeGreaterThan(80);
		expect(report.verdict).toBe('go');
		expect(report.socialPreview?.title).toBe('Preflight');
		expect(report.launchBrief?.headline).toBeTruthy();
	});

	it('samples sitemap URLs and warns when they are dead', async () => {
		const sitemapXml =
			'<?xml version="1.0"?><urlset><url><loc>https://app.test/a</loc></url><url><loc>https://app.test/b</loc></url></urlset>';
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps,
			headOk: async (url: string) => !url.endsWith('/b'),
			fetchText: async (url: string) => (url.endsWith('/sitemap.xml') ? sitemapXml : null)
		});
		const sitemap = report.checks.find((c) => c.id === 'sitemap');
		expect(sitemap?.status).toBe('warn');
		expect(sitemap?.message).toContain('1 of 2 sampled failed');
	});

	it('reports sampled sitemap URLs as reachable when they all respond', async () => {
		const sitemapXml = '<urlset><url><loc>https://app.test/a</loc></url></urlset>';
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps,
			fetchText: async (url: string) => (url.endsWith('/sitemap.xml') ? sitemapXml : null)
		});
		const sitemap = report.checks.find((c) => c.id === 'sitemap');
		expect(sitemap?.status).toBe('pass');
		expect(sitemap?.message).toContain('1 sampled URL(s) reachable');
	});

	it('flags cookie-based analytics without a consent banner', async () => {
		const html = GOOD_HTML.replace(
			'</head>',
			'<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ"></script></head>'
		);
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({ ...LEGAL_ROUTES, '/': { html } }),
			...mockDeps
		});
		const consent = report.checks.find((c) => c.id === 'cookie-consent');
		expect(consent?.status).toBe('warn');
		expect(consent?.message).toContain('GDPR');
	});

	it('passes cookie consent when a banner tool is present', async () => {
		const html = GOOD_HTML.replace(
			'</head>',
			'<script src="https://www.googletagmanager.com/gtm.js"></script><script src="https://consent.cookiebot.com/uc.js"></script></head>'
		);
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({ ...LEGAL_ROUTES, '/': { html } }),
			...mockDeps
		});
		const consent = report.checks.find((c) => c.id === 'cookie-consent');
		expect(consent?.status).toBe('pass');
		expect(consent?.message).toContain('Cookiebot');
	});

	it('passes host consistency when the www sibling reaches the same site', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps
		});
		const host = report.checks.find((c) => c.id === 'host-consistency');
		expect(host?.status).toBe('pass');
		expect(host?.message).toContain('www.app.test');
	});

	it('warns when the sibling host does not resolve', async () => {
		const routed = routedFetchHtml(LEGAL_ROUTES);
		const report = await scanUrl('https://app.test', {
			fetchHtml: async (url: URL) => {
				if (url.hostname === 'www.app.test') throw new Error('DNS failure');
				return routed(url);
			},
			...mockDeps
		});
		const host = report.checks.find((c) => c.id === 'host-consistency');
		expect(host?.status).toBe('warn');
		expect(host?.message).toContain('does not resolve');
	});

	it('warns when apple-touch-icon is missing', async () => {
		const html = GOOD_HTML.replace(/<link rel="apple-touch-icon"[^>]*>/, '');
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({ ...LEGAL_ROUTES, '/': { html } }),
			...mockDeps
		});
		const icon = report.checks.find((c) => c.id === 'apple-touch-icon');
		expect(icon?.status).toBe('warn');
	});

	it('warns on multiple H1 headings', async () => {
		const html = GOOD_HTML.replace('</body>', '<h1>Second heading</h1></body>');
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({ ...LEGAL_ROUTES, '/': { html } }),
			...mockDeps
		});
		const h1 = report.checks.find((c) => c.id === 'h1');
		expect(h1?.status).toBe('warn');
		expect(h1?.message).toContain('2 H1s');
	});

	it('verifies legal page content and reports pagesScanned', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps
		});
		const privacy = report.checks.find((c) => c.id === 'privacy');
		expect(privacy?.status).toBe('pass');
		expect(privacy?.message).toContain('Verified /privacy');
		expect(report.pagesScanned?.map((p) => p.role)).toEqual(['home', 'privacy', 'terms']);
		expect(report.pagesScanned?.[0].status).toBe(200);
	});

	it('fails privacy when the linked page 404s', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({
				'/': { html: GOOD_HTML },
				'/privacy': { html: 'not found', status: 404 },
				'/terms': { html: LEGAL_PAGE_HTML }
			}),
			...mockDeps
		});
		const privacy = report.checks.find((c) => c.id === 'privacy');
		expect(privacy?.status).toBe('fail');
		expect(privacy?.message).toContain('HTTP 404');
	});

	it('warns when the privacy page is a stub', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({
				'/': { html: GOOD_HTML },
				'/privacy': { html: STUB_PAGE_HTML },
				'/terms': { html: LEGAL_PAGE_HTML }
			}),
			...mockDeps
		});
		const privacy = report.checks.find((c) => c.id === 'privacy');
		expect(privacy?.status).toBe('warn');
		expect(privacy?.message).toContain('stub');
	});

	it('finds placeholder copy on crawled sub-pages', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({
				'/': { html: GOOD_HTML },
				'/privacy': { html: LEGAL_PAGE_HTML },
				'/terms': { html: `${LEGAL_PAGE_HTML.replace('</body>', '<p>Lorem ipsum dolor</p></body>')}` }
			}),
			...mockDeps
		});
		const placeholder = report.checks.find((c) => c.id === 'placeholder-copy');
		expect(placeholder?.status).toBe('fail');
		expect(placeholder?.message).toContain('(on /terms)');
	});

	it('warns on broken internal links', async () => {
		const html = `${GOOD_HTML}<a href="/missing">Broken</a>`;
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({ ...LEGAL_ROUTES, '/': { html } }),
			headOk: async (url) => !url.includes('missing'),
			headProbe: mockDeps.headProbe,
			fetchText: mockDeps.fetchText
		});
		const links = report.checks.find((c) => c.id === 'links');
		expect(links?.status).not.toBe('pass');
	});

	it('rejects blocked urls before fetch', async () => {
		await expect(
			scanUrl('https://127.0.0.1', {
				fetchHtml: async () => ({
					html: '<html></html>',
					finalUrl: new URL('https://127.0.0.1/'),
					status: 200,
					headers: STRONG_HEADERS,
					redirectHops: 0
				}),
				...mockDeps
			})
		).rejects.toThrow();
	});

	it('skips content checks when homepage returns 403', async () => {
		const report = await scanUrl('https://blocked.test', {
			fetchHtml: async () => ({
				html: '<html><head></head><body>Access denied</body></html>',
				finalUrl: new URL('https://blocked.test/'),
				status: 403,
				headers: STRONG_HEADERS,
				redirectHops: 0
			}),
			...mockDeps
		});
		expect(report.scanCoverage).toBe('blocked');
		expect(report.checks.map((c) => c.id)).toEqual(['reachable', 'https']);
		expect(report.checks.find((c) => c.id === 'privacy')).toBeUndefined();
		expect(report.verdictMessage).toContain('403');
		expect(report.launchBrief?.headline).toContain('incomplete');
	});

	it('builds a license audit from detected CDN libraries', async () => {
		const html = `${GOOD_HTML}<script src="https://cdnjs.cloudflare.com/ajax/libs/highcharts/11.4.0/highcharts.min.js"></script>`;
		const report = await scanUrl('https://app.test', {
			fetchHtml: async () => ({
				html,
				finalUrl: new URL('https://app.test/'),
				status: 200,
				headers: STRONG_HEADERS,
				redirectHops: 0
			}),
			...mockDeps
		});
		expect(report.licenseAudit?.libraries.map((l) => l.name)).toContain('highcharts');
		expect(report.licenseAudit?.sellable).toBe('conditions');
		const check = report.checks.find((c) => c.id === 'license-risk');
		expect(check?.status).toBe('warn');
		expect(check?.fixPrompt).toContain('Highcharts');
	});

	it('passes license check when no libraries are detected', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: async () => ({
				html: GOOD_HTML,
				finalUrl: new URL('https://app.test/'),
				status: 200,
				headers: STRONG_HEADERS,
				redirectHops: 0
			}),
			...mockDeps
		});
		const check = report.checks.find((c) => c.id === 'license-risk');
		expect(check?.status).toBe('pass');
		expect(report.licenseAudit?.sellable).toBe('yes');
	});

	it('flags secrets in sampled same-origin JS bundles', async () => {
		const html = `${GOOD_HTML}<script src="/app.js"></script>`;
		const report = await scanUrl('https://app.test', {
			fetchHtml: async () => ({
				html,
				finalUrl: new URL('https://app.test/'),
				status: 200,
				headers: STRONG_HEADERS,
				redirectHops: 0
			}),
			headOk: async () => true,
			headProbe: mockDeps.headProbe,
			fetchText: async (url) =>
				url.endsWith('/app.js') ? 'const key = "sk_live_1234567890123456789012";' : null
		});
		const secrets = report.checks.find((c) => c.id === 'secrets');
		expect(secrets?.status).toBe('fail');
		expect(secrets?.message).toContain('sampled JS');
	});

	it('flags secrets in source maps linked from bundles', async () => {
		const html = `${GOOD_HTML}<script src="/app.js"></script>`;
		const map = JSON.stringify({
			sources: ['config.ts'],
			sourcesContent: ['export const key = "sk_live_1234567890123456789012";']
		});
		const report = await scanUrl('https://app.test', {
			fetchHtml: async () => ({
				html,
				finalUrl: new URL('https://app.test/'),
				status: 200,
				headers: STRONG_HEADERS,
				redirectHops: 0
			}),
			headOk: async () => true,
			headProbe: mockDeps.headProbe,
			fetchText: async (url) => {
				if (url.endsWith('/app.js')) return '//# sourceMappingURL=app.js.map';
				if (url.endsWith('/app.js.map')) return map;
				return null;
			}
		});
		const secrets = report.checks.find((c) => c.id === 'secrets');
		expect(secrets?.status).toBe('fail');
		expect(secrets?.message).toContain('source maps');
	});

	it('samples scripts from crawled sub-pages', async () => {
		const pricingHtml = `${GOOD_HTML}<script src="/pricing-only.js"></script>`;
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({
				'/': { html: `${GOOD_HTML}<a href="/pricing">Pricing</a>` },
				'/pricing': { html: pricingHtml }
			}),
			headOk: async () => true,
			headProbe: mockDeps.headProbe,
			fetchText: async (url) =>
				url.endsWith('/pricing-only.js') ? 'const key = "sk_live_1234567890123456789012";' : null
		});
		const secrets = report.checks.find((c) => c.id === 'secrets');
		expect(secrets?.status).toBe('fail');
		expect(secrets?.message).toContain('sampled JS');
	});

	it('passes 404 handling when missing paths return 404', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps
		});
		const nf = report.checks.find((c) => c.id === 'not-found-page');
		expect(nf?.status).toBe('pass');
	});

	it('warns on soft 404s (missing paths return 200)', async () => {
		// Fetcher answers 200 with the homepage for every path — classic SPA fallback.
		const report = await scanUrl('https://app.test', {
			fetchHtml: async (url: URL) => ({
				html: GOOD_HTML,
				finalUrl: url,
				status: 200,
				headers: STRONG_HEADERS,
				redirectHops: 0
			}),
			...mockDeps
		});
		const nf = report.checks.find((c) => c.id === 'not-found-page');
		expect(nf?.status).toBe('warn');
		expect(nf?.message).toContain('soft 404');
	});

	it('reports response time from the homepage fetch', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps
		});
		const rt = report.checks.find((c) => c.id === 'response-time');
		expect(rt?.status).toBe('pass');
		expect(rt?.message).toMatch(/responded in \d+ms/);
	});

	it('checks SPF/DMARC when a TXT resolver is provided', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps,
			resolveTxt: async (name: string) =>
				name === 'app.test'
					? ['v=spf1 include:_spf.example.com ~all']
					: []
		});
		const email = report.checks.find((c) => c.id === 'email-auth');
		expect(email?.status).toBe('warn');
		expect(email?.message).toContain('no DMARC');
	});

	it('passes email auth with both SPF and DMARC', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps,
			resolveTxt: async (name: string) =>
				name === 'app.test'
					? ['v=spf1 ~all']
					: name === '_dmarc.app.test'
						? ['v=DMARC1; p=none']
						: []
		});
		const email = report.checks.find((c) => c.id === 'email-auth');
		expect(email?.status).toBe('pass');
	});

	it('skips the email check without a resolver', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps
		});
		expect(report.checks.find((c) => c.id === 'email-auth')).toBeUndefined();
	});
});
