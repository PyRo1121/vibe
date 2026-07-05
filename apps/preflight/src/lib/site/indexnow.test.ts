import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	INDEXNOW_KEY,
	buildIndexNowPayload,
	extractSitemapUrls,
	isDeploylintCanonicalUrl
} from './indexnow';

describe('IndexNow helpers', () => {
	it('uses a protocol-compliant public key', () => {
		expect(INDEXNOW_KEY).toMatch(/^[A-Za-z0-9-]{8,128}$/);
	});

	it('publishes the same key file referenced by submitted payloads', () => {
		const publishedKey = readFileSync(
			new URL(`../../../static/${INDEXNOW_KEY}.txt`, import.meta.url),
			'utf8'
		).trim();

		expect(publishedKey).toBe(INDEXNOW_KEY);
	});

	it('extracts canonical Deploylint URLs from sitemap XML', () => {
		const urls = extractSitemapUrls(`<?xml version="1.0"?>
<urlset>
  <url><loc>https://deploylint.com/</loc></url>
  <url><loc>https://deploylint.com/checks</loc></url>
  <url><loc>https://example.com/nope</loc></url>
  <url><loc>http://deploylint.com/http-version</loc></url>
</urlset>`);

		expect(urls).toEqual(['https://deploylint.com/', 'https://deploylint.com/checks']);
	});

	it('builds an IndexNow payload for the canonical host only', () => {
		const payload = buildIndexNowPayload([
			'https://deploylint.com/',
			'https://deploylint.com/guides/ai-app-launch-checker',
			'https://www.deploylint.com/',
			'https://deploylint.com/r/private'
		]);

		expect(payload).toEqual({
			host: 'deploylint.com',
			key: INDEXNOW_KEY,
			keyLocation: `https://deploylint.com/${INDEXNOW_KEY}.txt`,
			urlList: ['https://deploylint.com/', 'https://deploylint.com/guides/ai-app-launch-checker']
		});
	});

	it('rejects non-canonical, private, and API URLs', () => {
		expect(isDeploylintCanonicalUrl('https://deploylint.com/checks')).toBe(true);
		expect(isDeploylintCanonicalUrl('https://www.deploylint.com/checks')).toBe(false);
		expect(isDeploylintCanonicalUrl('https://deploylint.com/api/scan')).toBe(false);
		expect(isDeploylintCanonicalUrl('https://deploylint.com/r/report-id')).toBe(false);
		expect(isDeploylintCanonicalUrl('https://deploylint.com/s/script.js')).toBe(false);
	});
});
