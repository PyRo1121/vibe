import { describe, expect, it } from 'vitest';
import type { ScanCheck } from '$lib/scan/types';
import type { PageMeta } from '$lib/scan/parse';
import { pushMetaChecks } from './meta';

const checkCtx = { url: 'https://app.test/' };

function emptyMeta(overrides: Partial<PageMeta> = {}): PageMeta {
	return {
		title: null,
		resolvedTitle: null,
		description: null,
		ogTitle: null,
		ogDescription: null,
		ogImage: null,
		viewport: false,
		favicon: false,
		appleTouchIcon: false,
		lang: null,
		h1: false,
		h1Count: 0,
		missingAlts: 0,
		links: [],
		legal: { privacy: false, terms: false, contact: false },
		stack: { stripe: false, supabase: false, firebase: false },
		canonical: null,
		robotsNoindex: false,
		twitterCard: null,
		twitterImage: null,
		scriptCount: 0,
		blockingScripts: 0,
		htmlBytes: 0,
		...overrides
	};
}

function run(html: string, meta = emptyMeta()): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushMetaChecks(checks, html, meta, checkCtx, []);
	return checks;
}

describe('pushMetaChecks', () => {
	it('fails privacy when no policy link', () => {
		const privacy = run('<html><body><p>Hello</p></body></html>').find((c) => c.id === 'privacy');
		expect(privacy?.status).toBe('fail');
	});

	it('passes title when present', () => {
		const title = run(
			'<html></html>',
			emptyMeta({ resolvedTitle: 'My Product', title: 'My Product' })
		).find((c) => c.id === 'title');
		expect(title?.status).toBe('pass');
	});
});
