import { describe, expect, it } from 'vitest';
import type { ScanCheck } from '$lib/scan/types';
import { pushSecurityDepthChecks } from './security-depth';

function run(html: string, finalUrl = 'https://app.test/'): ScanCheck[] {
	const checks: ScanCheck[] = [];
	const url = new URL(finalUrl);
	pushSecurityDepthChecks(checks, html, url, { url: url.href });
	return checks;
}

function get(checks: ScanCheck[], id: string): ScanCheck | undefined {
	return checks.find((c) => c.id === id);
}

function page(body: string): string {
	return `<!doctype html><html><head></head><body>${body}</body></html>`;
}

describe('form-security', () => {
	it('fails when an HTTPS page posts a form to HTTP', () => {
		const check = get(run(page('<form action="http://legacy.oldhost.com/submit"></form>')), 'form-security');
		expect(check?.status).toBe('fail');
		expect(check?.message).toContain('legacy.oldhost.com');
	});

	it('fails when a password field exists on an HTTP page', () => {
		const check = get(
			run(page('<input type="password" name="pw">'), 'http://app.test/'),
			'form-security'
		);
		expect(check?.status).toBe('fail');
		expect(check?.message).toContain('Password field on an HTTP page');
	});

	it('passes for HTTPS forms and relative actions', () => {
		const html = page(
			'<form action="https://app.test/submit"></form><form action="/signup"></form>'
		);
		const check = get(run(html), 'form-security');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('2 forms post over HTTPS');
	});

	it('does not fail for password on HTTPS without insecure forms', () => {
		const check = get(run(page('<input type="password" name="pw">')), 'form-security');
		expect(check).toBeUndefined();
	});

	it('emits nothing when there are no forms or password fields', () => {
		expect(get(run(page('<p>Hello</p>')), 'form-security')).toBeUndefined();
	});
});

describe('sri', () => {
	it('skips when there are no third-party scripts', () => {
		expect(get(run(page('<script src="/app.js"></script>')), 'sri')).toBeUndefined();
	});

	it('warns when 3+ third-party scripts lack integrity', () => {
		const html = page(
			[
				'<script src="https://cdn.one.com/a.js"></script>',
				'<script src="https://cdn.two.com/b.js"></script>',
				'<script src="https://cdn.three.com/c.js"></script>'
			].join('')
		);
		const check = get(run(html), 'sri');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('without Subresource Integrity');
	});

	it('passes with real third-party and SRI counts', () => {
		const html = page(
			'<script src="https://cdn.one.com/a.js" integrity="sha384-abc"></script>' +
				'<script src="https://cdn.two.com/b.js"></script>'
		);
		const check = get(run(html), 'sri');
		expect(check?.status).toBe('pass');
		expect(check?.message).toBe('Third-party scripts: 2, 1 with SRI');
	});

	it('does not count same-origin scripts as third-party', () => {
		expect(get(run(page('<script src="https://app.test/app.js"></script>')), 'sri')).toBeUndefined();
	});
});

describe('noopener', () => {
	it('emits nothing when there are no target=_blank links', () => {
		expect(get(run(page('<a href="/about">About</a>')), 'noopener')).toBeUndefined();
	});

	it('warns when 3+ external _blank links lack noopener', () => {
		const html = page(
			[
				'<a target="_blank" href="https://one.test/a">A</a>',
				'<a target="_blank" href="https://two.test/b">B</a>',
				'<a target="_blank" href="https://three.test/c">C</a>'
			].join('')
		);
		const check = get(run(html), 'noopener');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('without rel=noopener');
	});

	it('passes when rel includes noopener noreferrer', () => {
		const html = page('<a target="_blank" rel="noopener noreferrer" href="https://x.test">X</a>');
		expect(get(run(html), 'noopener')?.status).toBe('pass');
	});

	it('treats rel="nofollow" alone as unsafe but under threshold', () => {
		const html = page('<a target="_blank" rel="nofollow" href="https://x.test">X</a>');
		expect(get(run(html), 'noopener')?.status).toBe('pass');
	});
});

describe('wp-exposure', () => {
	it('skips on non-WordPress pages', () => {
		expect(get(run(page('<p>Blog</p>')), 'wp-exposure')).toBeUndefined();
	});

	it('warns when WordPress version or xmlrpc is exposed', () => {
		const html = page(
			'<script src="/wp-includes/js/wp-embed.js"></script><link rel="pingback" href="/xmlrpc.php">'
		);
		const check = get(run(html), 'wp-exposure');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('WordPress version/xmlrpc exposed');
	});

	it('passes for WordPress without version/xmlrpc exposure', () => {
		const html = page('<img src="/wp-content/uploads/logo.png">');
		expect(get(run(html), 'wp-exposure')?.status).toBe('pass');
	});

	it('warns on generator meta with version', () => {
		const html = page(
			'<meta name="generator" content="WordPress 6.4.2"><img src="/wp-content/uploads/logo.png">'
		);
		expect(get(run(html), 'wp-exposure')?.status).toBe('warn');
	});
});

describe('mailto-exposure', () => {
	it('skips when no emails are present', () => {
		expect(get(run(page('<p>Contact us</p>')), 'mailto-exposure')).toBeUndefined();
	});

	it('passes for one or two real emails', () => {
		const check = get(run(page('<a href="mailto:support@app.test">Email</a>')), 'mailto-exposure');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('Contact email visible');
	});

	it('warns for 3+ distinct emails', () => {
		const html = page(
			'<p>a@app.test b@b.app.test c@c.app.test d@d.app.test</p>'
		);
		const check = get(run(html), 'mailto-exposure');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('4 email addresses');
	});

	it('excludes example.com and @2x.png false positives', () => {
		const html = page(
			'<img src="logo@2x.png"><p>hello@example.com and real@app.test</p>'
		);
		const check = get(run(html), 'mailto-exposure');
		expect(check?.status).toBe('pass');
	});

	it('ignores emails inside script blocks', () => {
		const html = page('<script>const x = "secret@bundle.test";</script><p>hi@app.test</p>');
		const check = get(run(html), 'mailto-exposure');
		expect(check?.status).toBe('pass');
	});
});

describe('pushSecurityDepthChecks', () => {
	it('uses the security category and allows form-security to fail', () => {
		const checks = run(page('<form action="http://bad.test/post"></form>'));
		const form = get(checks, 'form-security');
		expect(form?.category).toBe('security');
		expect(form?.status).toBe('fail');
		expect(form?.fixPrompt.length).toBeGreaterThan(0);
	});
});
