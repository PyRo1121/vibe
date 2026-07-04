import { describe, expect, it } from 'vitest';
import type { ScanCheck } from '$lib/scan/types';
import { pushA11yDepthChecks } from './a11y-depth';

function run(html: string): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushA11yDepthChecks(checks, html, { url: 'https://app.test' });
	return checks;
}

function byId(checks: ScanCheck[], id: string): ScanCheck | undefined {
	return checks.find((c) => c.id === id);
}

function page(body: string): string {
	return `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;
}

const NAV_LINKS = Array.from({ length: 25 }, (_, i) => `<a href="/p${i}">Page ${i}</a>`).join('');

describe('form-labels', () => {
	it('emits nothing when the page has no form fields', () => {
		const checks = run(page('<h1>Landing</h1><p>Copy</p><a href="/about">About</a>'));
		expect(byId(checks, 'form-labels')).toBeUndefined();
	});

	it('passes when every field has a real label', () => {
		const checks = run(
			page(
				'<form>' +
					'<label for="email">Email</label><input type="email" id="email">' +
					'<label>Name <input type="text"></label>' +
					'<textarea aria-label="Message"></textarea>' +
					'</form>'
			)
		);
		const check = byId(checks, 'form-labels');
		expect(check?.status).toBe('pass');
		expect(check?.message).toContain('All 3 form field');
	});

	it('warns when fields rely on placeholder alone', () => {
		const checks = run(
			page('<input type="text" placeholder="Your name"><input placeholder="Email">')
		);
		const check = byId(checks, 'form-labels');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('2 of 2');
		expect(check?.message).toContain('placeholder');
	});

	it('treats a wrapping <label> as a label', () => {
		const checks = run(page('<label>Email <input type="email"></label>'));
		expect(byId(checks, 'form-labels')?.status).toBe('pass');
	});

	it('reads single-quoted attributes', () => {
		const checks = run(page("<input type='text' aria-label='Full name'>"));
		expect(byId(checks, 'form-labels')?.status).toBe('pass');
	});

	it('counts unlabeled select and textarea fields', () => {
		const checks = run(page('<select><option>A</option></select><textarea></textarea>'));
		const check = byId(checks, 'form-labels');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('2 of 2');
	});

	it('ignores hidden, submit, and checkbox inputs', () => {
		const checks = run(
			page(
				'<input type="hidden" name="csrf"><input type="submit" value="Go"><input type="checkbox" id="tos">'
			)
		);
		expect(byId(checks, 'form-labels')).toBeUndefined();
	});
});

describe('accessible-names', () => {
	it('passes when buttons and links have names', () => {
		const checks = run(page('<button>Save</button><a href="/about">About</a>'));
		expect(byId(checks, 'accessible-names')?.status).toBe('pass');
	});

	it('warns for svg-only icon buttons', () => {
		const checks = run(
			page('<button class="icon"><svg viewBox="0 0 24 24"><path d="M4 4h16"/></svg></button>')
		);
		const check = byId(checks, 'accessible-names');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain("announce 'button'");
	});

	it('accepts aria-label as an accessible name', () => {
		const checks = run(page("<button aria-label='Close'><svg><path d='M0 0'/></svg></button>"));
		expect(byId(checks, 'accessible-names')?.status).toBe('pass');
	});

	it('accepts an img alt child as an accessible name', () => {
		const checks = run(page('<button><img src="/search.png" alt="Search"></button>'));
		expect(byId(checks, 'accessible-names')?.status).toBe('pass');
	});

	it('flags icon links and empty role=button elements', () => {
		const checks = run(
			page(
				'<a href="https://x.com/app"><svg><path/></svg></a><div role="button" class="fab"></div>'
			)
		);
		const check = byId(checks, 'accessible-names');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('1 button(s)');
		expect(check?.message).toContain('1 link(s)');
	});

	it('emits nothing when the page has no buttons or links', () => {
		const checks = run(page('<h1>Hello</h1><p>World</p>'));
		expect(byId(checks, 'accessible-names')).toBeUndefined();
	});

	it('ignores buttons, links, and inputs inside script and svg blocks', () => {
		const checks = run(
			page(
				'<h1>Docs</h1><script>render(\'<button></button><a href="#x"></a><input type="text">\')</script>' +
					'<svg><a href="#part"><path/></a></svg>'
			)
		);
		expect(byId(checks, 'accessible-names')).toBeUndefined();
		expect(byId(checks, 'form-labels')).toBeUndefined();
	});
});

describe('landmarks', () => {
	it('passes with a <main> element or role=main', () => {
		expect(byId(run(page('<main><h1>Hi</h1></main>')), 'landmarks')?.status).toBe('pass');
		expect(byId(run(page('<div role="main"><h1>Hi</h1></div>')), 'landmarks')?.status).toBe(
			'pass'
		);
	});

	it('warns when no main landmark exists', () => {
		const check = byId(run(page('<div><h1>Hi</h1></div>')), 'landmarks');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('No <main> landmark');
	});
});

describe('positive-tabindex', () => {
	it('warns on tabindex values of 1 or more', () => {
		const checks = run(page('<div tabindex="1">a</div><span tabindex=\'5\'>b</span>'));
		const check = byId(checks, 'positive-tabindex');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('2 element(s)');
	});

	it('does not flag tabindex 0 or -1', () => {
		const checks = run(page('<div tabindex="0">a</div><div tabindex="-1">b</div>'));
		expect(byId(checks, 'positive-tabindex')?.status).toBe('pass');
	});
});

describe('skip-link', () => {
	it('emits nothing without a nav or with few links', () => {
		const fewLinks = page('<nav><a href="/a">A</a><a href="/b">B</a></nav>');
		expect(byId(run(fewLinks), 'skip-link')).toBeUndefined();
		const noNav = page(`<div>${NAV_LINKS}</div>`);
		expect(byId(run(noNav), 'skip-link')).toBeUndefined();
	});

	it('passes when an early skip anchor targets content', () => {
		const checks = run(
			page(
				`<a class="skip" href="#main">Skip to content</a><nav>${NAV_LINKS}</nav><main id="main"></main>`
			)
		);
		expect(byId(checks, 'skip-link')?.status).toBe('pass');
	});

	it('warns on nav-heavy pages without a skip link', () => {
		const checks = run(page(`<nav>${NAV_LINKS}</nav><main></main>`));
		const check = byId(checks, 'skip-link');
		expect(check?.status).toBe('warn');
		expect(check?.message).toContain('tab through');
	});

	it('ignores skip links buried past the first 1500 bytes', () => {
		const filler = `<p>${'x'.repeat(1600)}</p>`;
		const checks = run(page(`${filler}<a href="#main">Skip to content</a><nav>${NAV_LINKS}</nav>`));
		expect(byId(checks, 'skip-link')?.status).toBe('warn');
	});
});

describe('pushA11yDepthChecks', () => {
	it('only ever reports pass or warn, all in the a11y category', () => {
		const messy = page(
			'<input type="text" placeholder="hi"><button><svg><path/></svg></button>' +
				'<a href="/x"></a><div tabindex="3">x</div>'
		);
		const checks = run(messy);
		expect(checks.length).toBe(4);
		expect(checks.every((c) => c.status === 'pass' || c.status === 'warn')).toBe(true);
		expect(checks.every((c) => c.category === 'a11y')).toBe(true);
		expect(checks.every((c) => c.fixPrompt.length > 0)).toBe(true);
	});
});
