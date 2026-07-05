import type { PageMeta } from '$lib/scan/parse';
import { parsePageMeta } from '$lib/scan/parse';
import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushMetaChecks } from './meta';

const checkCtx = { url: 'https://app.test/' };

function emptyMeta(overrides: Partial<PageMeta> = {}): PageMeta {
	return {
		...parsePageMeta('<html></html>', new URL(checkCtx.url), []),
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

	it('warns when the page omits charset-meta and passes when UTF-8 is declared', () => {
		const missing = run('<html><head></head><body></body></html>').find(
			(c) => c.id === 'charset-meta'
		);
		const present = run('<html><head><meta charset="utf-8"></head><body></body></html>').find(
			(c) => c.id === 'charset-meta'
		);

		expect(missing?.status).toBe('warn');
		expect(present?.status).toBe('pass');
	});

	it('reports img-alt status from parsed missing alt counts', () => {
		const imgAlt = run('<html></html>', emptyMeta({ missingAlts: 2 })).find(
			(c) => c.id === 'img-alt'
		);

		expect(imgAlt?.status).toBe('warn');
		expect(imgAlt?.message).toContain('2 image(s) missing alt');
	});
});
