#!/usr/bin/env node
import {
	INDEXNOW_KEY,
	buildIndexNowPayload,
	extractSitemapUrls
} from '../src/lib/site/indexnow.ts';

const baseUrl = process.env.DEPLOYLINT_SITE_URL ?? 'https://deploylint.com';
const sitemapUrl = new URL('/sitemap.xml', baseUrl);
sitemapUrl.searchParams.set('indexnow', String(Date.now()));
const endpoint = process.env.INDEXNOW_ENDPOINT ?? 'https://www.bing.com/indexnow';
const dryRun = process.argv.includes('--dry-run');

const sitemap = await fetch(sitemapUrl, {
	headers: { Accept: 'application/xml,text/xml,*/*' }
});

if (!sitemap.ok) {
	console.error(`IndexNow sitemap fetch failed: ${sitemap.status} ${sitemap.statusText}`);
	process.exit(1);
}

const urls = extractSitemapUrls(await sitemap.text());
const payload = buildIndexNowPayload(urls);

if (payload.urlList.length === 0) {
	console.error('IndexNow found no canonical URLs to submit.');
	process.exit(1);
}

if (dryRun) {
	console.log(JSON.stringify(payload, null, 2));
	process.exit(0);
}

const response = await fetch(endpoint, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json; charset=utf-8' },
	body: JSON.stringify(payload)
});

const body = await response.text();
console.log(
	`IndexNow submitted ${payload.urlList.length} URL(s) with key ${INDEXNOW_KEY.slice(0, 8)}...: ${response.status} ${response.statusText}`
);
if (body.trim()) console.log(body);

if (![200, 202].includes(response.status)) process.exit(1);
