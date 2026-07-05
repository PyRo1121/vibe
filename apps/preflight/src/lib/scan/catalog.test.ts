import { describe, expect, it } from 'vitest';
import { CHECK_CATALOG, catalogEntries, getCheckCatalogEntry } from './catalog';
import { P0_CHECK_IDS } from './p0-ids';

describe('check catalog', () => {
	it('documents the new service-aware checks', () => {
		for (const id of [
			'paddle',
			'lemon-squeezy',
			'auth-provider',
			'error-monitoring',
			'ai-client-api'
		]) {
			const entry = getCheckCatalogEntry(id);
			expect(entry, `missing ${id}`).toBeTruthy();
			expect(entry?.why.length).toBeGreaterThan(40);
			expect(entry?.detectedBy.length).toBeGreaterThan(20);
		}
	});

	it('documents high-risk security and deployment checks first', () => {
		for (const id of [
			'exposed-env',
			'exposed-git',
			'dependency-vulns',
			'secrets',
			'health-endpoint',
			'web-manifest'
		]) {
			expect(getCheckCatalogEntry(id), `missing ${id}`).toBeTruthy();
		}
	});

	it('documents every P0 launch blocker', () => {
		for (const id of P0_CHECK_IDS) {
			const entry = getCheckCatalogEntry(id);
			expect(entry, `missing P0 ${id}`).toBeTruthy();
			expect(entry?.why.length).toBeGreaterThan(40);
			expect(entry?.detectedBy.length).toBeGreaterThan(20);
		}
	});

	it('documents security header checks', () => {
		for (const id of [
			'hsts-header',
			'csp-header',
			'clickjack-header',
			'mime-sniff-header',
			'referrer-header',
			'permissions-policy-header'
		]) {
			const entry = getCheckCatalogEntry(id);
			expect(entry, `missing security header ${id}`).toBeTruthy();
			expect(entry?.why.length).toBeGreaterThan(40);
			expect(entry?.detectedBy.length).toBeGreaterThan(20);
		}
	});

	it('documents SEO, social preview, and AI discoverability checks', () => {
		for (const id of [
			'ai-crawlers',
			'answer-signals',
			'canonical',
			'charset-meta',
			'clarity',
			'description',
			'duplicate-meta',
			'h1',
			'heading-order',
			'hreflang',
			'json-ld',
			'lang',
			'llms-txt',
			'meta-keywords',
			'noindex',
			'og-image-live',
			'og-image-type',
			'og-site-name',
			'og-url-match',
			'open-graph',
			'robots-block',
			'semantic-html',
			'sitemap',
			'text-ratio',
			'title',
			'title-brand-dupe',
			'twitter-card',
			'viewport'
		]) {
			const entry = getCheckCatalogEntry(id);
			expect(entry, `missing SEO/discoverability ${id}`).toBeTruthy();
			expect(entry?.why.length).toBeGreaterThan(40);
			expect(entry?.detectedBy.length).toBeGreaterThan(20);
		}
	});

	it('has stable unique ids', () => {
		const ids = catalogEntries().map((entry) => entry.id);

		expect(new Set(ids).size).toBe(ids.length);
		expect(Object.keys(CHECK_CATALOG)).toEqual([...ids].sort());
	});

	it('returns null for checks that are not cataloged yet', () => {
		expect(getCheckCatalogEntry('not-real')).toBeNull();
	});
});
