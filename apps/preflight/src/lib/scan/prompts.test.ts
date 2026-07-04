import { describe, expect, it } from 'vitest';
import { makeCheck } from './score';
import { buildMasterPrompt, fixPrompt, pickSamplePromptCheck } from './prompts';

describe('buildMasterPrompt', () => {
	it('orders p0 before p2', () => {
		const checks = [
			makeCheck('favicon', 'seo', 'Favicon', 'warn', 'Missing', 'fix favicon'),
			makeCheck('privacy', 'legal', 'Privacy', 'fail', 'Missing', 'fix privacy')
		];
		checks[0].priority = 'p2';
		checks[1].priority = 'p0';
		const prompt = buildMasterPrompt(checks, 'https://app.test');
		expect(prompt.indexOf('[P0]')).toBeLessThan(prompt.indexOf('[P2]'));
	});

	it('returns incomplete-scan guidance when blocked', () => {
		const checks = [
			makeCheck('reachable', 'launch', 'Site reachable', 'fail', 'HTTP 403', 'fix reachability')
		];
		const prompt = buildMasterPrompt(checks, 'https://doordash.com/', {
			scanCoverage: 'blocked',
			httpStatus: 403
		});
		expect(prompt).toContain('Do NOT fix SEO');
		expect(prompt).toContain('HTTP 403');
		expect(prompt).not.toContain('[P1]');
	});

	it('does not invent an HTTP status when the fetch failed entirely', () => {
		const checks = [
			makeCheck('fetch', 'launch', 'Site reachable', 'fail', 'network error', 'fix fetch')
		];
		const prompt = buildMasterPrompt(checks, 'https://down.test/', { scanCoverage: 'blocked' });
		expect(prompt).toContain('fetch failed');
		expect(prompt).not.toContain('HTTP 403');
	});
});

describe('fixPrompt reachable template', () => {
	it('gives bot-block guidance only for 401/403', () => {
		expect(fixPrompt('reachable', { url: 'https://a.test', message: 'HTTP 403' })).toContain(
			'blocked'
		);
		expect(fixPrompt('reachable', { url: 'https://a.test', message: 'HTTP 500' })).not.toContain(
			'whitelist'
		);
		// Must not false-match digits inside longer numbers or URLs
		expect(
			fixPrompt('reachable', { url: 'https://a.test', message: 'HTTP 500 at /page4033' })
		).not.toContain('whitelist');
	});
});

describe('fixPrompt coverage for new check ids', () => {
	const FALLBACK = 'Fix this launch readiness issue';
	const NEW_IDS = [
		'form-labels',
		'accessible-names',
		'landmarks',
		'positive-tabindex',
		'skip-link',
		'img-dimensions',
		'img-lazy',
		'font-loading',
		'preconnect',
		'blocking-css',
		'inline-data-bloat',
		'heading-order',
		'duplicate-meta',
		'hreflang',
		'og-url-match',
		'meta-keywords',
		'title-brand-dupe',
		'form-security',
		'sri',
		'noopener',
		'wp-exposure',
		'mailto-exposure',
		'ai-crawlers',
		'text-ratio',
		'semantic-html',
		'answer-signals',
		'og-site-name',
		'primary-cta',
		'cta-competition',
		'pricing-path',
		'social-proof',
		'signup-friction',
		'copyright-year',
		'dead-social-links',
		'broken-anchor-nav',
		'default-favicon-title',
		'last-updated-staleness',
		'ci-config',
		'tests-present',
		'lockfile-committed',
		'node-version-pinned',
		'ts-strict'
	];

	it('every new check id has a real template, not the generic fallback', () => {
		for (const id of NEW_IDS) {
			const prompt = fixPrompt(id, { url: 'https://a.test' });
			expect(prompt, `missing template for ${id}`).not.toContain(FALLBACK);
			expect(prompt).toContain(`Check: ${id}`);
		}
	});
});

describe('pickSamplePromptCheck', () => {
	it('picks highest priority failing check', () => {
		const checks = [
			makeCheck('favicon', 'seo', 'Favicon', 'warn', 'Missing', 'fix favicon'),
			makeCheck('privacy', 'legal', 'Privacy', 'fail', 'Missing', 'fix privacy')
		];
		checks[0].priority = 'p2';
		checks[1].priority = 'p0';
		expect(pickSamplePromptCheck(checks)?.id).toBe('privacy');
	});
});
