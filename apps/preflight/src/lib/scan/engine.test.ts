import { GOOD_HTML } from '$lib/test/fixtures/good-html';
import { LEGAL_PAGE_HTML, STUB_PAGE_HTML } from '$lib/test/fixtures/legal-html';
import { STRONG_HEADERS } from '$lib/test/fixtures/scan-headers';
import { describe, expect, it } from 'vitest';

import {
	collectSitemapLocs,
	discoverSitemapLocs,
	extractRobotsSitemapUrls,
	extractSitemapLocs,
	scanUrl
} from './engine';

const mockDeps = {
	headOk: async () => true,
	headProbe: async () => ({ reachable: true, isImage: true, contentType: 'image/png' }),
	fetchText: async () => null
};

/** Serves different HTML per path; unknown paths fall back to '/'. The 404-probe path gets a real 404. */
function routedFetchHtml(routes: Record<string, { html: string; status?: number }>) {
	return async (url: URL) => {
		if (url.pathname.startsWith('/preflight-missing-')) {
			return {
				html: 'not found',
				finalUrl: url,
				status: 404,
				headers: STRONG_HEADERS,
				redirectHops: 0
			};
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

function checksById(report: Awaited<ReturnType<typeof scanUrl>>) {
	return Object.fromEntries(report.checks.map((check) => [check.id, check]));
}

const FAKE_STRIPE_LIVE_KEY = ['sk', 'live', '123456789012345678901234'].join('_');

describe('extractRobotsSitemapUrls', () => {
	const origin = new URL('https://app.test/');

	it('parses Sitemap lines case-insensitively and skips cross-origin', () => {
		const robots = [
			'User-agent: *',
			'Sitemap: https://app.test/sitemap-pages.xml',
			'sitemap: https://evil.test/x',
			'SITEMAP: https://app.test/sitemap-blog.xml'
		].join('\n');
		expect(extractRobotsSitemapUrls(robots, origin)).toEqual([
			'https://app.test/sitemap-pages.xml',
			'https://app.test/sitemap-blog.xml'
		]);
	});

	it('returns empty for null or missing directives', () => {
		expect(extractRobotsSitemapUrls(null, origin)).toEqual([]);
		expect(extractRobotsSitemapUrls('User-agent: *\nDisallow:', origin)).toEqual([]);
	});
});

describe('discoverSitemapLocs', () => {
	const origin = new URL('https://app.test/');

	it('merges locs from robots-declared sitemaps and default /sitemap.xml', async () => {
		const robots =
			'User-agent: *\nSitemap: https://app.test/sitemap-pages.xml\nSitemap: https://app.test/sitemap.xml';
		const pagesXml =
			'<urlset><url><loc>https://app.test/about</loc></url><url><loc>https://app.test/contact</loc></url></urlset>';
		const defaultXml = '<urlset><url><loc>https://app.test/pricing</loc></url></urlset>';

		const result = await discoverSitemapLocs(
			origin,
			robots,
			async (url) => url.includes('sitemap'),
			async (url) => {
				if (url.endsWith('/sitemap-pages.xml')) return pagesXml;
				if (url.endsWith('/sitemap.xml')) return defaultXml;
				return null;
			}
		);

		expect(result.ok).toBe(true);
		expect(result.locs).toEqual([
			'https://app.test/pricing',
			'https://app.test/about',
			'https://app.test/contact'
		]);
	});
});

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

describe('collectSitemapLocs', () => {
	const origin = new URL('https://app.test/');

	it('follows a sitemap index into child urlsets', async () => {
		const index =
			'<sitemapindex><sitemap><loc>https://app.test/sitemap-pages.xml</loc></sitemap></sitemapindex>';
		const child =
			'<urlset><url><loc>https://app.test/about</loc></url><url><loc>https://app.test/contact</loc></url></urlset>';
		const locs = await collectSitemapLocs(index, origin, async (url) =>
			url.endsWith('/sitemap-pages.xml') ? child : null
		);
		expect(locs).toEqual(['https://app.test/about', 'https://app.test/contact']);
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
		expect(report.socialPreview?.title).toBe('Acme Launch');
		expect(report.launchBrief?.headline).toBeTruthy();
	});

	it('catches a hostile launch across SEO, security, trust, conversion, and ops in one scan', async () => {
		const badHtml = `<!doctype html>
<html>
<head>
  <title>Vite App</title>
  <meta name="description" content="Welcome">
  <meta name="robots" content="noindex,nofollow">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:title" content="Demo">
  <meta property="og:description" content="Demo">
  <meta property="og:image" content="/og.png">
  <link rel="canonical" href="https://other.test/">
  <script src="https://js.stripe.com/v3"></script>
  <script>const supabaseUrl = "https://demo.supabase.co";</script>
</head>
<body>
  <div tabindex="2">Trap focus</div>
  <h1>Launch app</h1>
  <h3>Skipped heading</h3>
  <p>Lorem ipsum TODO your product name here. Plans start at $19/mo. Sign up today.</p>
  <form><input type="email" placeholder="Email"><button disabled>Get started</button></form>
  <a href="/privacy">Privacy</a>
  <a href="/terms">Terms</a>
  <a href="/dead">Dead link</a>
  <a href="#">Book a demo</a>
  <a href="https://twitter.com/">X</a>
  <img src="/a.png"><img src="/b.png"><img src="/c.png"><img src="/d.png">
</body>
</html>`;
		const fetchHtml = async (url: URL) => {
			if (url.hostname === 'www.app.test') {
				return {
					html: badHtml,
					finalUrl: url,
					status: 200,
					headers: STRONG_HEADERS,
					redirectHops: 0
				};
			}
			if (url.pathname === '/privacy') {
				return {
					html: STUB_PAGE_HTML,
					finalUrl: url,
					status: 200,
					headers: STRONG_HEADERS,
					redirectHops: 0
				};
			}
			if (url.pathname === '/terms') {
				return {
					html: 'missing',
					finalUrl: url,
					status: 404,
					headers: STRONG_HEADERS,
					redirectHops: 0
				};
			}
			return {
				html: badHtml,
				finalUrl: url,
				status: 200,
				headers: STRONG_HEADERS,
				redirectHops: 0
			};
		};
		const headOk = async (url: string) =>
			url.endsWith('/robots.txt') ||
			url.endsWith('/.env') ||
			url.endsWith('/.git/HEAD') ||
			url.endsWith('/backup.zip') ||
			url.endsWith('/package.json') ||
			url.endsWith('/privacy');
		const fetchText = async (url: string) => {
			if (url.endsWith('/robots.txt')) return 'User-agent: *\nDisallow: /';
			if (url.endsWith('/.env')) return `STRIPE_SECRET_KEY=${FAKE_STRIPE_LIVE_KEY}`;
			if (url.endsWith('/.git/HEAD')) return 'ref: refs/heads/main\n';
			if (url.endsWith('/backup.zip')) return 'PK'.padEnd(128, 'x');
			if (url.endsWith('/package.json')) return '{"name":"leaky-app"}';
			return null;
		};

		const report = await scanUrl('https://app.test', {
			fetchHtml,
			headOk,
			headProbe: async () => ({ reachable: true, isImage: false, contentType: 'text/html' }),
			fetchText
		});
		const byId = checksById(report);
		const expectedStatuses = {
			noindex: 'fail',
			canonical: 'warn',
			'og-image-live': 'fail',
			'og-image-type': 'fail',
			'robots-block': 'fail',
			'exposed-env': 'fail',
			'exposed-git': 'fail',
			'exposed-backup': 'fail',
			'exposed-package': 'warn',
			'not-found-page': 'warn',
			links: 'warn',
			privacy: 'warn',
			terms: 'fail',
			'placeholder-copy': 'fail',
			'form-labels': 'warn',
			'positive-tabindex': 'warn',
			landmarks: 'warn',
			'health-endpoint': 'warn',
			stripe: 'warn',
			supabase: 'warn',
			'dead-social-links': 'warn',
			'default-favicon-title': 'warn',
			'cta-availability': 'warn'
		} as const;

		for (const [id, status] of Object.entries(expectedStatuses)) {
			expect(byId[id]?.status).toBe(status);
		}
		expect(byId['privacy']?.message).toContain('stub');
		expect(byId['terms']?.message).toContain('HTTP 404');
		expect(byId['exposed-env']?.message).toContain('/.env');
		expect(report.verdict).toBe('no-go');
		expect(
			report.checks.filter((check) => check.status === 'fail').map((check) => check.id)
		).toEqual(
			expect.arrayContaining([
				'noindex',
				'og-image-live',
				'og-image-type',
				'robots-block',
				'exposed-env',
				'exposed-git',
				'exposed-backup',
				'terms',
				'placeholder-copy'
			])
		);
	});

	it('does not invent blockers on a launch-ready site with crawl, SEO, security, and email evidence', async () => {
		const healthyHtml = `<!doctype html>
<html lang="en">
<head>
  <title>Deploylint Launch Readiness Scanner</title>
  <meta name="description" content="Deploylint checks SEO, security, payments, legal pages, and production readiness before a public launch.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:title" content="Deploylint">
  <meta property="og:description" content="Launch readiness scanner">
  <meta property="og:image" content="https://app.test/og.png">
  <meta property="og:url" content="https://app.test/">
  <meta property="og:site_name" content="Deploylint">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://app.test/">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="preconnect" href="https://plausible.io">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Deploylint"}</script>
  <script async src="https://plausible.io/js/script.js"></script>
</head>
<body>
  <a href="#main">Skip to content</a>
  <nav><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/pricing">Pricing</a></nav>
  <main id="main">
    <h1>Scan before you ship</h1>
    <p>Deploylint is a launch readiness scanner for app builders who need a trustworthy preflight check before they publish.</p>
    <a href="/signup">Get started</a>
    <p>Plans start at $19/mo. Trusted by 500+ builders.</p>
    <img src="/hero.png" width="1200" height="800" alt="Deploylint report">
    <img src="/a.png" width="100" height="100" alt="A">
    <img src="/b.png" width="100" height="100" alt="B">
    <img src="/c.png" width="100" height="100" loading="lazy" alt="C">
  </main>
  <footer><a href="mailto:support@app.test">Contact support</a><a href="https://x.com/deploylint">X</a></footer>
</body>
</html>`;
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({
				'/': { html: healthyHtml },
				'/privacy': { html: LEGAL_PAGE_HTML },
				'/terms': { html: LEGAL_PAGE_HTML },
				'/pricing': { html: LEGAL_PAGE_HTML },
				'/about': { html: LEGAL_PAGE_HTML }
			}),
			headOk: async (url: string) =>
				[
					'/robots.txt',
					'/sitemap.xml',
					'/llms.txt',
					'/.well-known/security.txt',
					'/health',
					'/privacy',
					'/terms',
					'/pricing',
					'/signup',
					'/about'
				].some((path) => url.endsWith(path)),
			headProbe: async () => ({ reachable: true, isImage: true, contentType: 'image/png' }),
			fetchText: async (url: string) => {
				if (url.endsWith('/robots.txt')) return 'User-agent: *\nAllow: /';
				if (url.endsWith('/sitemap.xml'))
					return '<urlset><url><loc>https://app.test/pricing</loc></url><url><loc>https://app.test/about</loc></url></urlset>';
				if (url.endsWith('/llms.txt'))
					return '# Deploylint\nLaunch readiness scanner for production apps.';
				if (url.endsWith('/.well-known/security.txt')) return 'Contact: mailto:security@app.test';
				return null;
			},
			resolveTxt: async (name: string) => {
				if (name === 'app.test') return ['v=spf1 include:_spf.example.com ~all'];
				if (name === '_dmarc.app.test') return ['v=DMARC1; p=none'];
				if (name === 'default._domainkey.app.test') return ['v=DKIM1; k=rsa; p=MIIB'];
				return [];
			}
		});
		const byId = checksById(report);

		expect(
			report.checks.filter((check) => check.status === 'fail').map((check) => check.id)
		).toEqual([]);
		for (const id of [
			'noindex',
			'canonical',
			'open-graph',
			'og-image-live',
			'og-image-type',
			'robots-block',
			'sitemap',
			'llms-txt',
			'security-txt',
			'web-manifest',
			'not-found-page',
			'email-auth',
			'dkim-dns',
			'privacy',
			'terms',
			'placeholder-copy',
			'img-dimensions',
			'img-lazy',
			'dead-social-links',
			'support-path',
			'legal-links'
		]) {
			expect(byId[id]?.status).toBe('pass');
		}
		expect(report.verdict).not.toBe('no-go');
		expect(report.pagesScanned?.map((page) => page.role)).toEqual([
			'home',
			'privacy',
			'terms',
			'pricing',
			'sitemap'
		]);
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

	it('crawls supplemental pages from sitemap.xml and sweeps placeholders', async () => {
		const placeholderHtml =
			'<html><head><title>About</title></head><body><p>TODO fix later on about page</p></body></html>';
		const sitemapXml =
			'<urlset><url><loc>https://app.test/about</loc></url><url><loc>https://app.test/contact</loc></url></urlset>';
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({
				...LEGAL_ROUTES,
				'/about': { html: placeholderHtml }
			}),
			...mockDeps,
			fetchText: async (url: string) => (url.endsWith('/sitemap.xml') ? sitemapXml : null)
		});
		expect(report.pagesScanned?.map((p) => p.role)).toEqual([
			'home',
			'privacy',
			'terms',
			'sitemap'
		]);
		const placeholder = report.checks.find((c) => c.id === 'placeholder-copy');
		expect(placeholder?.message).toContain('/about');
	});

	it('crawls pricing from sitemap when homepage links omit it', async () => {
		const sitemapXml = '<urlset><url><loc>https://app.test/plans</loc></url></urlset>';
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({
				...LEGAL_ROUTES,
				'/plans': { html: LEGAL_PAGE_HTML }
			}),
			...mockDeps,
			fetchText: async (url: string) => (url.endsWith('/sitemap.xml') ? sitemapXml : null)
		});
		expect(report.pagesScanned?.map((p) => p.role)).toContain('pricing');
		expect(report.pagesScanned?.find((p) => p.role === 'pricing')?.url).toBe(
			'https://app.test/plans'
		);
	});

	it('discovers alternate sitemaps from robots.txt', async () => {
		const robots = 'User-agent: *\nSitemap: https://app.test/sitemap-pages.xml';
		const pagesXml = '<urlset><url><loc>https://app.test/about</loc></url></urlset>';
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({
				...LEGAL_ROUTES,
				'/about': { html: LEGAL_PAGE_HTML }
			}),
			...mockDeps,
			fetchText: async (url: string) => {
				if (url.endsWith('/robots.txt')) return robots;
				if (url.endsWith('/sitemap-pages.xml')) return pagesXml;
				return null;
			},
			headOk: async (url: string) =>
				url.endsWith('/robots.txt') ||
				url.endsWith('/sitemap-pages.xml') ||
				url.endsWith('/sitemap.xml') ||
				url.endsWith('/about')
		});
		const sitemap = report.checks.find((c) => c.id === 'sitemap');
		expect(sitemap?.status).toBe('pass');
		expect(report.pagesScanned?.some((p) => p.url.includes('/about'))).toBe(true);
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
				'/terms': {
					html: LEGAL_PAGE_HTML.replace('</body>', '<p>Lorem ipsum dolor</p></body>')
				}
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
		).rejects.toThrow('That URL cannot be scanned');
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
				url.endsWith('/app.js') ? `const key = "${FAKE_STRIPE_LIVE_KEY}";` : null
		});
		const secrets = report.checks.find((c) => c.id === 'secrets');
		expect(secrets?.status).toBe('fail');
		expect(secrets?.message).toContain('sampled JS');
	});

	it('flags secrets in source maps linked from bundles', async () => {
		const html = `${GOOD_HTML}<script src="/app.js"></script>`;
		const map = JSON.stringify({
			sources: ['config.ts'],
			sourcesContent: [`export const key = "${FAKE_STRIPE_LIVE_KEY}";`]
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
		const termsHtml = `${GOOD_HTML}<script src="/terms-only.js"></script>`;
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml({
				'/': { html: `${GOOD_HTML}<a href="/privacy">Privacy</a><a href="/terms">Terms</a>` },
				'/privacy': { html: LEGAL_PAGE_HTML },
				'/terms': { html: termsHtml }
			}),
			headOk: async () => true,
			headProbe: mockDeps.headProbe,
			fetchText: async (url) =>
				url.endsWith('/terms-only.js') ? `const key = "${FAKE_STRIPE_LIVE_KEY}";` : null
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
				name === 'app.test' ? ['v=spf1 include:_spf.example.com ~all'] : []
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

	it('warns on dkim-dns when SPF is set but no DKIM selector is found', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps,
			resolveTxt: async (name: string) =>
				name === 'app.test' ? ['v=spf1 include:_spf.example.com ~all'] : []
		});
		const dkim = report.checks.find((c) => c.id === 'dkim-dns');
		expect(dkim?.status).toBe('warn');
		expect(dkim?.message).toContain('no DKIM selector');
	});

	it('passes dkim-dns when a common selector record exists', async () => {
		const report = await scanUrl('https://app.test', {
			fetchHtml: routedFetchHtml(LEGAL_ROUTES),
			...mockDeps,
			resolveTxt: async (name: string) => {
				if (name === 'app.test') return ['v=spf1 ~all'];
				if (name === 'default._domainkey.app.test') return ['v=DKIM1; k=rsa; p=MIIB'];
				return [];
			}
		});
		const dkim = report.checks.find((c) => c.id === 'dkim-dns');
		expect(dkim?.status).toBe('pass');
		expect(dkim?.message).toContain('default._domainkey');
	});
});
