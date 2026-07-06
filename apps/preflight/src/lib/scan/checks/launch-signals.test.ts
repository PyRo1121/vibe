import { parsePageMeta } from '$lib/scan/parse';
import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushLaunchSignalChecks } from './launch-signals';

const CTX = { url: 'https://app.test/' };
const FINAL_URL = new URL(CTX.url);

function run(html: string, ogImageOk: boolean | null = null): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushLaunchSignalChecks(checks, parsePageMeta(html, FINAL_URL), FINAL_URL, CTX, ogImageOk);
	return checks;
}

function get(checks: ScanCheck[], id: string): ScanCheck | undefined {
	return checks.find((check) => check.id === id);
}

function doc(head = '', body = '<h1>Acme</h1>'): string {
	return `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

describe('noindex', () => {
	it('fails when the homepage explicitly blocks indexing and passes otherwise', () => {
		const blocked = run(doc('<meta name="robots" content="noindex,nofollow">'));
		const indexable = run(doc());

		expect(get(blocked, 'noindex')?.status).toBe('fail');
		expect(get(blocked, 'noindex')?.message).toContain('noindex');
		expect(get(indexable, 'noindex')?.status).toBe('pass');
	});
});

describe('canonical', () => {
	it('passes when canonical matches the final URL', () => {
		const checks = run(doc('<link rel="canonical" href="https://app.test/">'));

		expect(get(checks, 'canonical')?.status).toBe('pass');
	});

	it('warns when canonical is missing, invalid, or points elsewhere', () => {
		const missing = run(doc());
		const invalid = run(doc('<link rel="canonical" href="https://">'));
		const elsewhere = run(doc('<link rel="canonical" href="https://other.test/">'));

		expect(get(missing, 'canonical')?.status).toBe('warn');
		expect(get(invalid, 'canonical')?.status).toBe('warn');
		expect(get(elsewhere, 'canonical')?.status).toBe('warn');
		expect(get(elsewhere, 'canonical')?.message).toContain('elsewhere');
	});
});

describe('twitter-card', () => {
	it('warns when Open Graph tags exist without twitter-card', () => {
		const checks = run(
			doc('<meta property="og:title" content="Acme"><meta property="og:image" content="/og.png">')
		);

		expect(get(checks, 'twitter-card')?.status).toBe('warn');
	});

	it('warns when summary_large_image lacks any image fallback', () => {
		const checks = run(doc('<meta name="twitter:card" content="summary_large_image">'));

		expect(get(checks, 'twitter-card')?.status).toBe('warn');
	});

	it('passes when twitter-card metadata has an image fallback', () => {
		const checks = run(
			doc(
				'<meta name="twitter:card" content="summary_large_image"><meta property="og:image" content="/og.png">'
			)
		);

		expect(get(checks, 'twitter-card')?.status).toBe('pass');
	});
});

describe('page-weight', () => {
	it('passes for small pages and warns for many blocking scripts', () => {
		const pass = run(doc('', '<h1>Acme</h1>'));
		const warn = run(doc('<script></script><script></script><script></script>', '<h1>Acme</h1>'));

		expect(get(pass, 'page-weight')?.status).toBe('pass');
		expect(get(warn, 'page-weight')?.status).toBe('warn');
	});

	it('fails for very large HTML payloads', () => {
		const checks = run(doc('', `<h1>Acme</h1><p>${'x'.repeat(1600 * 1024)}</p>`));

		expect(get(checks, 'page-weight')?.status).toBe('fail');
	});
});

describe('og-image-live', () => {
	it('emits pass and fail checks when the image probe ran', () => {
		const good = run(doc('<meta property="og:image" content="/og.png">'), true);
		const bad = run(doc('<meta property="og:image" content="/og.png">'), false);

		expect(get(good, 'og-image-live')?.status).toBe('pass');
		expect(get(bad, 'og-image-live')?.status).toBe('fail');
	});

	it('does not emit og-image-live when the probe did not run', () => {
		const checks = run(doc('<meta property="og:image" content="/og.png">'), null);

		expect(get(checks, 'og-image-live')).toBeUndefined();
	});
});
