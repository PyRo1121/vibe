import { describe, expect, it } from 'vitest';
import { buildContentChecks } from './analyze';
import { extractLinks } from './parse';
import { clarityScore, scoreChecks, buildReport, makeCheck } from './score';
import { GOOD_HTML } from '$lib/test/fixtures/good-html';
import { STRONG_HEADERS } from '$lib/test/fixtures/scan-headers';

describe('clarityScore', () => {
	it('passes when title, description, and h1 are solid', () => {
		expect(
			clarityScore(
				'Preflight Launch Checker for Apps',
				'Scan your vibe-coded app before launch. Free SEO, legal, security, and ship-readiness checks for Cursor and Lovable builders worldwide.',
				true
			)
		).toBe('pass');
	});

	it('fails when everything missing', () => {
		expect(clarityScore(null, null, false)).toBe('fail');
	});
});

describe('scoreChecks', () => {
	it('returns 100 for all pass', () => {
		const checks = [
			makeCheck('a', 'seo', 'A', 'pass', 'ok', 'fix'),
			makeCheck('b', 'seo', 'B', 'pass', 'ok', 'fix')
		];
		expect(scoreChecks(checks)).toBe(100);
	});

	it('returns 50 for all warn', () => {
		const checks = [makeCheck('a', 'seo', 'A', 'warn', 'ok', 'fix')];
		expect(scoreChecks(checks)).toBe(50);
	});
});

describe('buildContentChecks', () => {
	it('scores a well-formed landing page highly', () => {
		const finalUrl = new URL('https://app.test/');
		const links = extractLinks(GOOD_HTML, finalUrl);
		const checks = buildContentChecks(
			GOOD_HTML,
			finalUrl,
			200,
			{
				brokenCount: 0,
				checkedCount: 3,
				robotsOk: true,
				sitemapOk: true,
				llmsTxtOk: false,
				robotsText: 'User-agent: *\nAllow: /'
			},
			links,
			[],
			STRONG_HEADERS
		);
		const report = buildReport('https://app.test', finalUrl, checks);
		expect(report.score).toBeGreaterThanOrEqual(80);
		expect(report.summary.fail).toBe(0);
		expect(checks.find((c) => c.id === 'privacy')?.status).toBe('pass');
	});

	it('fails privacy and viewport on bare page', () => {
		const html = '<html><body><h2>No setup</h2></body></html>';
		const finalUrl = new URL('http://insecure.test/');
		const checks = buildContentChecks(
			html,
			finalUrl,
			200,
			{
				brokenCount: 0,
				checkedCount: 0,
				robotsOk: false,
				sitemapOk: false,
				llmsTxtOk: false,
				robotsText: null
			},
			[]
		);
		expect(checks.find((c) => c.id === 'https')?.status).toBe('fail');
		expect(checks.find((c) => c.id === 'viewport')?.status).toBe('fail');
		expect(checks.find((c) => c.id === 'privacy')?.status).toBe('fail');
	});

	it('detects exposed secrets', () => {
		const finalUrl = new URL('https://app.test/');
		const html = `${GOOD_HTML}<script>api_key = "supersecret12345"</script>`;
		const links = extractLinks(html, finalUrl);
		const checks = buildContentChecks(
			html,
			finalUrl,
			200,
			{
				brokenCount: 0,
				checkedCount: 0,
				robotsOk: false,
				sitemapOk: false,
				llmsTxtOk: false,
				robotsText: null
			},
			links
		);
		expect(checks.find((c) => c.id === 'secrets')?.status).toBe('fail');
	});
});
