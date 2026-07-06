import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushTrustChecks } from './trust';

const NOW = new Date('2026-07-04T12:00:00Z');

function run(html: string, now = NOW): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushTrustChecks(checks, html, { url: 'https://app.test/' }, now);
	return checks;
}

function get(checks: ScanCheck[], id: string): ScanCheck | undefined {
	return checks.find((c) => c.id === id);
}

function page(body: string, head = ''): string {
	return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

describe('copyright-year', () => {
	it('skips when no copyright notice exists', () => {
		expect(get(run(page('<footer>Acme Inc</footer>')), 'copyright-year')).toBeUndefined();
	});

	it('passes for a current copyright year', () => {
		const check = get(run(page('<footer>© 2026 Acme</footer>')), 'copyright-year');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('Copyright year is current (2026)');
	});

	it('uses the latest year from a range like © 2020-2026', () => {
		const check = get(run(page('<footer>© 2020-2026 Acme</footer>')), 'copyright-year');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('(2026)');
	});

	it('warns when the copyright year is stale', () => {
		const check = get(run(page('<footer>&copy; 2020 Acme</footer>')), 'copyright-year');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('© 2020');
	});
});

describe('dead-social-links', () => {
	it('skips when no social links exist', () => {
		expect(get(run(page('<a href="/about">About</a>')), 'dead-social-links')).toBeUndefined();
	});

	it('passes for concrete social profile links', () => {
		const html = page('<a href="https://x.com/acmehq">X</a>');
		const check = get(run(html), 'dead-social-links');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('1 social profile linked');
	});

	it('warns for twitter.com root placeholders', () => {
		const html = page('<a href="https://twitter.com/">Twitter</a>');
		const check = get(run(html), 'dead-social-links');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('social links go nowhere');
	});

	it('warns for yourhandle placeholders', () => {
		const html = page('<a href="https://github.com/yourhandle">GitHub</a>');
		expect(get(run(html), 'dead-social-links')?.status).toBe('warn');
	});

	it('treats malformed social hrefs as placeholder links', () => {
		const html = page('<a href="https://x.com:bad/profile">X</a>');
		expect(get(run(html), 'dead-social-links')?.status).toBe('warn');
	});
});

describe('broken-anchor-nav', () => {
	it('skips when there are no in-page anchors', () => {
		expect(get(run(page('<a href="/about">About</a>')), 'broken-anchor-nav')).toBeUndefined();
	});

	it('passes when anchors resolve to ids', () => {
		const html = page('<a href="#pricing">Pricing</a><section id="pricing">Plans</section>');
		const check = get(run(html), 'broken-anchor-nav');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('all resolve');
	});

	it('resolves name= targets', () => {
		const html = page('<a href="#team">Team</a><h2 name="team">Team</h2>');
		expect(get(run(html), 'broken-anchor-nav')?.status).toBe('pass');
	});

	it('warns when anchor targets are missing', () => {
		const html = page('<a href="#pricing">Pricing</a><section id="plans">Plans</section>');
		const check = get(run(html), 'broken-anchor-nav');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('#pricing has no target');
	});

	it('warns when 3+ href="#" stubs exist', () => {
		const html = page('<a href="#">One</a><a href="#">Two</a><a href="#">Three</a>');
		const check = get(run(html), 'broken-anchor-nav');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain("href='#' stubs");
	});
});

describe('default-favicon-title', () => {
	it('skips for real product titles', () => {
		expect(
			get(run(page('', '<title>Acme Launch Scanner</title>')), 'default-favicon-title')
		).toBeUndefined();
	});

	it('warns for exact template title matches like Vite App', () => {
		const check = get(run(page('', '<title>Vite App</title>')), 'default-favicon-title');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('Vite App');
	});

	it('does not match partial titles like Vite Appliances Store', () => {
		expect(
			get(run(page('', '<title>Vite Appliances Store</title>')), 'default-favicon-title')
		).toBeUndefined();
	});

	it('warns for vite.svg favicon leftovers', () => {
		const html = page('', '<link rel="icon" href="/vite.svg">');
		expect(get(run(html), 'default-favicon-title')?.status).toBe('warn');
	});
});

describe('last-updated-staleness', () => {
	it('skips when no freshness phrase exists', () => {
		expect(get(run(page('<p>Welcome</p>')), 'last-updated-staleness')).toBeUndefined();
	});

	it('passes for a recent updated date', () => {
		const html = page('<p>Last updated 2026-05-01</p>');
		expect(get(run(html), 'last-updated-staleness')?.status).toBe('pass');
	});

	it('warns when the updated date is more than 18 months old', () => {
		const html = page('<p>Last updated 2024-10-01</p>');
		const check = get(run(html), 'last-updated-staleness');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('stale timestamps');
	});
});

describe('legal-links', () => {
	it('warns when a commercial page has no privacy or terms links', () => {
		const html = page(
			'<main><h1>Acme</h1><p>Plans start at $19/mo. Sign up today.</p>' +
				'<form><input type="email" required></form></main>'
		);

		const check = get(run(html), 'legal-links');

		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('No privacy or terms links');
	});

	it('names the one missing legal link on commercial pages', () => {
		const missingTerms = page(
			'<main><p>Plans start at $19/mo. Sign up today.</p></main><footer><a href="/privacy">Privacy</a></footer>'
		);
		const missingPrivacy = page(
			'<main><p>Plans start at $19/mo. Sign up today.</p></main><footer><a href="/terms">Terms</a></footer>'
		);

		expect(get(run(missingTerms), 'legal-links')?.message).toContain('Missing terms link');
		expect(get(run(missingPrivacy), 'legal-links')?.message).toContain('Missing privacy link');
	});

	it('passes when privacy and terms links are present', () => {
		const html = page(
			'<main><h1>Acme</h1><p>Plans start at $19/mo. Sign up today.</p></main>' +
				'<footer><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></footer>'
		);

		const check = get(run(html), 'legal-links');

		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('Privacy and terms links present');
	});
});

describe('support-path', () => {
	it('warns when a support link is only a stub', () => {
		const html = page('<footer><a href="#">Contact support</a></footer>');

		const check = get(run(html), 'support-path');

		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('Support link is a stub');
	});

	it('passes for a real support mailbox', () => {
		const html = page('<footer><a href="mailto:support@acme.test">Contact support</a></footer>');

		const check = get(run(html), 'support-path');

		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('Support path is present');
	});

	it('warns on javascript and placeholder-domain support links', () => {
		const js = page('<footer><a href="javascript:void(0)">Support</a></footer>');
		const placeholder = page(
			'<footer><a href="https://example.com/support">Help center</a></footer>'
		);

		expect(get(run(js), 'support-path')).toMatchObject({ status: 'warn' });
		expect(get(run(placeholder), 'support-path')).toMatchObject({ status: 'warn' });
	});
});

describe('last-updated date parsing', () => {
	it('parses year-month and year-only freshness timestamps', () => {
		const yearMonth = get(run(page('<p>Updated on 2026/05</p>')), 'last-updated-staleness');
		const yearOnly = get(run(page('<p>Posted on 2024</p>')), 'last-updated-staleness');

		expect(yearMonth).toMatchObject({ status: 'pass' });
		expect(yearOnly).toMatchObject({ status: 'warn' });
		expect(yearOnly?.message).toContain('stale timestamps');
	});
});

describe('pushTrustChecks', () => {
	it('emits only launch-category pass/warn checks with fix prompts', () => {
		const html = page(
			'<footer>© 2020 Acme</footer><a href="https://twitter.com/">X</a><a href="#pricing">Pricing</a>'
		);
		const checks = run(html);
		expect(checks.length).toBeGreaterThanOrEqual(3);
		for (const check of checks) {
			expect(check.category).toBe('launch');
			expect(['pass', 'warn']).toContain(check.status);
			expect(check.fixPrompt.length).toBeGreaterThan(0);
		}
	});
});
