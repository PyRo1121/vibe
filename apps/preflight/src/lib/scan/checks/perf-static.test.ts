import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushPerfStaticChecks } from './perf-static';

const CTX = { url: 'https://app.test/' };

function run(html: string): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushPerfStaticChecks(checks, html, CTX);
	return checks;
}

function get(checks: ScanCheck[], id: string): ScanCheck | undefined {
	return checks.find((c) => c.id === id);
}

function page(body: string, head = ''): string {
	return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

describe('img-dimensions', () => {
	it('skips when fewer than 3 images', () => {
		expect(
			get(run(page('<img src="/a.png"><img src="/b.png">')), 'img-dimensions')
		).toBeUndefined();
	});

	it('passes when all images declare dimensions', () => {
		const html = page(
			'<img width="100" height="50" src="/a.png">' +
				'<img width="10" height="10" src="/b.png">' +
				'<img width="1" height="1" src="/c.png">'
		);
		const check = get(run(html), 'img-dimensions');
		expect(check?.status).toBe('pass');
		expect(check?.message).toBe('All 3 images declare dimensions');
	});

	it('counts inline style width/height as sized', () => {
		const html = page(
			'<img style="width:100px;height:50px" src="/a.png">' +
				'<img width="1" height="1" src="/b.png">' +
				'<img width="2" height="2" src="/c.png">'
		);
		expect(get(run(html), 'img-dimensions')?.status).toBe('pass');
	});

	it('warns when some images lack dimensions', () => {
		const html = page(
			'<img src="/a.png"><img width="1" height="1" src="/b.png"><img width="2" height="2" src="/c.png">'
		);
		const check = get(run(html), 'img-dimensions');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('1 of 3 images missing width/height');
	});
});

describe('img-lazy', () => {
	it('skips under 4 images', () => {
		expect(
			get(run(page('<img src="/a.png"><img src="/b.png"><img src="/c.png">')), 'img-lazy')
		).toBeUndefined();
	});

	it('warns when none lazy-load', () => {
		const html = page('<img src="/1.png"><img src="/2.png"><img src="/3.png"><img src="/4.png">');
		const check = get(run(html), 'img-lazy');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('none lazy-load');
	});

	it('passes when at least one image is lazy', () => {
		const html = page(
			'<img src="/1.png"><img src="/2.png"><img src="/3.png"><img loading="lazy" src="/4.png">'
		);
		expect(get(run(html), 'img-lazy')?.status).toBe('pass');
	});

	it('accepts uppercase LOADING="LAZY"', () => {
		const html = page(
			'<IMG LOADING="LAZY" src="/1.png"><img src="/2.png"><img src="/3.png"><img src="/4.png">'
		);
		expect(get(run(html), 'img-lazy')?.status).toBe('pass');
	});
});

describe('font-loading', () => {
	it('skips when no custom fonts', () => {
		expect(get(run(page('<p>Hi</p>')), 'font-loading')).toBeUndefined();
	});

	it('warns on @font-face without font-display', () => {
		const html = page('', '<style>@font-face { font-family: X; src: url(/f.woff); }</style>');
		const check = get(run(html), 'font-loading');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('without font-display');
	});

	it('passes when @font-face includes font-display', () => {
		const html = page(
			'',
			'<style>@font-face { font-family: X; font-display: swap; src: url(/f.woff); }</style>'
		);
		expect(get(run(html), 'font-loading')?.status).toBe('pass');
	});

	it('passes for Google Fonts with display=swap', () => {
		const html = page(
			'',
			'<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter&display=swap">'
		);
		expect(get(run(html), 'font-loading')?.status).toBe('pass');
	});

	it('warns for Google Fonts without display=', () => {
		const html = page(
			'',
			'<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter">'
		);
		expect(get(run(html), 'font-loading')?.status).toBe('warn');
	});
});

describe('preconnect', () => {
	it('skips with fewer than 2 third-party origins', () => {
		const html = page('<img src="https://app.test/logo.png">');
		expect(get(run(html), 'preconnect')).toBeUndefined();
	});

	it('warns when multiple third-party origins lack preconnect', () => {
		const html = page(
			'<script src="https://cdn.one.com/a.js"></script><img src="https://cdn.two.com/b.png">'
		);
		const check = get(run(html), 'preconnect');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('third-party origins with no preconnect');
	});

	it('passes with a preconnect hint', () => {
		const html = page(
			'<script src="https://cdn.one.com/a.js"></script><img src="https://cdn.two.com/b.png">',
			'<link rel="preconnect" href="https://cdn.one.com" crossorigin>'
		);
		expect(get(run(html), 'preconnect')?.status).toBe('pass');
	});

	it('accepts dns-prefetch as a hint', () => {
		const html = page(
			'<script src="https://cdn.one.com/a.js"></script><img src="https://cdn.two.com/b.png">',
			'<link rel="dns-prefetch" href="//cdn.one.com">'
		);
		expect(get(run(html), 'preconnect')?.status).toBe('pass');
	});
});

describe('blocking-css', () => {
	it('skips when no head exists', () => {
		expect(
			get(run('<div><link rel="stylesheet" href="/a.css"></div>'), 'blocking-css')
		).toBeUndefined();
	});

	it('passes with a modest number of stylesheets', () => {
		const html = page(
			'',
			'<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/b.css">'
		);
		expect(get(run(html), 'blocking-css')?.status).toBe('pass');
	});

	it('warns with 4+ render-blocking stylesheets', () => {
		const html = page(
			'',
			[
				'<link rel="stylesheet" href="/a.css">',
				'<link rel="stylesheet" href="/b.css">',
				'<link rel="stylesheet" href="/c.css">',
				'<link rel="stylesheet" href="/d.css">'
			].join('')
		);
		const check = get(run(html), 'blocking-css');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('4 render-blocking stylesheets');
	});

	it('ignores print media and disabled stylesheets', () => {
		const html = page(
			'',
			[
				'<link rel="stylesheet" href="/a.css">',
				'<link rel="stylesheet" href="/b.css" media="print">',
				'<link rel="stylesheet" href="/c.css" disabled>',
				'<link rel="stylesheet" href="/d.css">'
			].join('')
		);
		expect(get(run(html), 'blocking-css')?.status).toBe('pass');
	});
});

describe('inline-data-bloat', () => {
	it('skips when there are no inline scripts', () => {
		expect(get(run(page('<script src="/app.js"></script>')), 'inline-data-bloat')).toBeUndefined();
	});

	it('passes for modest inline JSON', () => {
		const html = page('<script>{"state":"small"}</script>');
		const check = get(run(html), 'inline-data-bloat');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('modest');
	});

	it('warns when inline JSON exceeds 150KB', () => {
		const payload = JSON.stringify({ data: 'x'.repeat(160 * 1024) });
		const html = page(`<script>${payload}</script>`);
		const check = get(run(html), 'inline-data-bloat');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('inline JSON state');
	});

	it('ignores large non-JSON inline scripts', () => {
		const html = page(`<script>console.log("${'a'.repeat(160 * 1024)}");</script>`);
		expect(get(run(html), 'inline-data-bloat')).toBeUndefined();
	});
});

describe('pushPerfStaticChecks', () => {
	it('emits only launch-category pass/warn checks with fix prompts', () => {
		const html = page(
			'<img src="/1.png"><img src="/2.png"><img src="/3.png"><img src="/4.png">',
			'<link rel="stylesheet" href="/a.css">'
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
