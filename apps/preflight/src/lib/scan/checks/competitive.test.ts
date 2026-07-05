import type { LinkCheckResult, ScanContext } from '$lib/scan/checks/context';
import type { CrawledPage } from '$lib/scan/crawl';
import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushCompetitiveChecks } from './competitive';

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

	it('fails robots-block when robots.txt blocks the whole site', () => {
		const robotsText = 'User-agent: *\nDisallow: /';
		const checks = run('<html></html>', {
			link: { robotsOk: true, robotsText },
			scan: { robotsText }
		});

		expect(get(checks, 'robots-block')?.status).toBe('fail');
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
