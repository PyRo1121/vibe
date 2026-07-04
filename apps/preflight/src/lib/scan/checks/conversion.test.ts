import { describe, expect, it } from 'vitest';
import type { ScanCheck } from '$lib/scan/types';
import { looksLikeProductPage, pushConversionChecks } from './conversion';

const CTX = { url: 'https://app.test/' };

function run(html: string): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushConversionChecks(checks, html, CTX);
	return checks;
}

function get(checks: ScanCheck[], id: string): ScanCheck | undefined {
	return checks.find((c) => c.id === id);
}

function page(body: string, head = ''): string {
	return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

function saasLanding(extra = ''): string {
	return page(
		'<nav><a href="/signup">Get started</a><a href="/features">Features</a><a href="/pricing">Pricing</a></nav>' +
			'<h1>Acme</h1><p>Simple pricing from $19/mo. Sign up today.</p>' +
			extra
	);
}

describe('looksLikeProductPage', () => {
	it('returns true for a SaaS landing with pricing and signup signals', () => {
		expect(looksLikeProductPage(saasLanding())).toBe(true);
	});

	it('returns false for a docs page with only login', () => {
		const html = page('<h1>Docs</h1><p>Read the docs.</p><a href="/login">Log in</a>');
		expect(looksLikeProductPage(html)).toBe(false);
	});

	it('ignores product signals inside script tags', () => {
		const html = page(
			'<script>const copy = "pricing and get started free";</script><p>Personal blog.</p>'
		);
		expect(looksLikeProductPage(html)).toBe(false);
	});
});

describe('gating', () => {
	it('emits zero checks on non-product pages even with CTAs', () => {
		const html = page('<button>Get started</button><button>Sign up</button>');
		expect(run(html)).toHaveLength(0);
	});
});

describe('primary-cta', () => {
	it('passes when a CTA appears in the nav above the fold', () => {
		const check = get(run(saasLanding()), 'primary-cta');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('Get started');
	});

	it('warns when the CTA appears late in the page', () => {
		const filler = '<p>' + 'content '.repeat(400) + '</p>';
		const html = page(
			'<nav><a href="/features">Features</a><a href="/pricing">Pricing</a></nav>' +
				filler +
				'<p>Pricing from $19/mo. Get started when ready.</p>' +
				'<a href="/signup">Get started</a>'
		);
		const check = get(run(html), 'primary-cta');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('appears late');
	});

	it('warns when no CTA exists anywhere', () => {
		const html = page(
			'<nav><a href="/features">Features</a><a href="/pricing">Pricing</a></nav>' +
				'<p>Pricing from $19/mo. Browse features and log in anytime.</p>'
		);
		const check = get(run(html), 'primary-cta');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('No clear call-to-action');
	});
});

describe('cta-competition', () => {
	it('dedupes repeated Get Started buttons', () => {
		const html = saasLanding(
			'<button>Get Started</button><button>Get  Started</button><a href="/x">Get started</a>'
		);
		const check = get(run(html), 'cta-competition');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('1 distinct');
	});

	it('warns when 8+ distinct CTAs compete', () => {
		const html = saasLanding(
			[
				'<button>Get started</button>',
				'<button>Sign up</button>',
				'<button>Try free</button>',
				'<button>Start free trial</button>',
				'<button>Buy now</button>',
				'<button>Download</button>',
				'<button>Install</button>',
				'<button>Book a demo</button>'
			].join('')
		);
		const check = get(run(html), 'cta-competition');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('competing calls-to-action');
	});
});

describe('pricing-path', () => {
	it('passes when a pricing link exists', () => {
		expect(get(run(saasLanding()), 'pricing-path')?.status).toBe('pass');
	});

	it('passes on currency amounts like €29', () => {
		const html = page(
			'<nav><a href="/features">Features</a><a href="/docs">Docs</a></nav>' +
				'<p>Plans from €29 per month. Sign up and log in anytime.</p>' +
				'<button>Get started</button>'
		);
		expect(get(run(html), 'pricing-path')?.status).toBe('pass');
	});

	it('warns when no pricing signal exists', () => {
		const html = page(
			'<nav><a href="/features">Features</a><a href="/docs">Docs</a></nav>' +
				'<p>All the features you need. Sign up and log in anytime.</p>'
		);
		const check = get(run(html), 'pricing-path');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('No pricing signal');
	});
});

describe('social-proof', () => {
	it('passes for trusted-by copy', () => {
		const html = saasLanding('<p>Trusted by 500+ teams</p>');
		expect(get(run(html), 'social-proof')?.status).toBe('pass');
	});

	it('passes for star ratings', () => {
		const html = saasLanding('<p>Rated ★★★★★ by users</p>');
		expect(get(run(html), 'social-proof')?.status).toBe('pass');
	});

	it('passes for numbered reviews', () => {
		const html = saasLanding('<p>500+ reviews on G2</p>');
		expect(get(run(html), 'social-proof')?.status).toBe('pass');
	});

	it('warns when no social proof is present', () => {
		const check = get(run(saasLanding()), 'social-proof');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('No social proof');
	});
});

describe('signup-friction', () => {
	it('warns when an email form asks for 4+ required fields', () => {
		const html = saasLanding(
			'<form>' +
				'<input type="email" required>' +
				'<input type="text" required>' +
				'<input type="text" required>' +
				'<input type="text" required>' +
				'<input type="password" required>' +
				'</form>'
		);
		const check = get(run(html), 'signup-friction');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('5 fields');
	});

	it('passes for low-friction email signup', () => {
		const html = saasLanding('<form><input type="email" required></form>');
		const check = get(run(html), 'signup-friction');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('low (1 field)');
	});

	it('skips when no email form exists', () => {
		expect(get(run(saasLanding()), 'signup-friction')).toBeUndefined();
	});
});

describe('pushConversionChecks', () => {
	it('emits only launch-category pass/warn checks with fix prompts', () => {
		const checks = run(saasLanding());
		expect(checks.length).toBeGreaterThanOrEqual(4);
		for (const check of checks) {
			expect(check.category).toBe('launch');
			expect(['pass', 'warn']).toContain(check.status);
			expect(check.fixPrompt.length).toBeGreaterThan(0);
		}
	});
});
