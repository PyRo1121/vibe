import {
	MAX_LINK_CHECKS,
	MAX_SCRIPT_FETCHES,
	MAX_SITEMAP_INDEX_CHILDREN,
	MAX_SITEMAP_LOCS,
	MAX_SOURCEMAP_FETCHES
} from '$lib/scan/constants';
import type { LinkCheckResult, OgImageProbe } from '$lib/scan/checks/context';
import type { ScanDeps } from '$lib/scan/fetchers';
import { auditScriptText } from '$lib/scan/license';
import {
	extractScriptSrcs,
	extractSourceMapUrl,
	findSecrets,
	pickMeta,
	searchableSourceMapText
} from '$lib/scan/parse';
import { llmsTxtLooksValid } from '$lib/scan/signals';
import { assertPublicHttpUrl } from '$lib/scan/url-guard';

/**
 * Active probes the engine fans out in parallel: link health, sitemap
 * sampling, script scanning, soft-404, email auth, host consistency, and the
 * og:image liveness check. All network access goes through injected ScanDeps.
 */

/** Bounded-concurrency map — keeps us polite to the target and inside Workers' connection queue. */
async function mapLimit<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const i = next;
			next += 1;
			results[i] = await fn(items[i]);
		}
	});
	await Promise.all(workers);
	return results;
}

/**
 * Bounded same-origin JS + source-map secret scan. Accepts one or more HTML
 * blobs (homepage + crawled sub-pages) and dedupes script URLs before fetching.
 */
export async function scanScripts(
	html: string | string[],
	finalUrl: URL,
	fetch: ScanDeps['fetchText']
): Promise<{ secrets: string[]; licenseFindings: ReturnType<typeof auditScriptText>[] }> {
	const blobs = Array.isArray(html) ? html : [html];
	const srcs = [...new Set(blobs.flatMap((h) => extractScriptSrcs(h, finalUrl)))].slice(
		0,
		MAX_SCRIPT_FETCHES
	);
	const secrets = new Set<string>();
	const licenseFindings: ReturnType<typeof auditScriptText>[] = [];
	const sourceMapUrls: string[] = [];

	const texts = await Promise.all(srcs.map((src) => fetch(src)));
	for (let i = 0; i < srcs.length; i += 1) {
		const text = texts[i];
		if (!text) continue;
		for (const label of findSecrets(text)) secrets.add(label);
		licenseFindings.push(auditScriptText(text, srcs[i]));

		const mapUrl = extractSourceMapUrl(text, srcs[i]);
		if (mapUrl) sourceMapUrls.push(mapUrl);
	}

	const maps = [...new Set(sourceMapUrls)].slice(0, MAX_SOURCEMAP_FETCHES);
	const mapTexts = await Promise.all(maps.map((url) => fetch(url)));
	for (const mapText of mapTexts) {
		if (!mapText) continue;
		for (const label of findSecrets(searchableSourceMapText(mapText))) secrets.add(label);
	}

	return { secrets: [...secrets], licenseFindings };
}

export async function checkLinks(
	links: string[],
	finalUrl: URL,
	head: ScanDeps['headOk'],
	fetch: ScanDeps['fetchText']
): Promise<LinkCheckResult> {
	const sameOriginLinks = links
		.filter((l) => {
			try {
				return new URL(l).origin === finalUrl.origin;
			} catch {
				return false;
			}
		})
		.slice(0, MAX_LINK_CHECKS);

	const checkRobots = async (): Promise<{ ok: boolean; text: string | null }> => {
		try {
			const robotsUrl = new URL('/robots.txt', finalUrl).href;
			const ok = await head(robotsUrl);
			return { ok, text: ok ? await fetch(robotsUrl) : null };
		} catch {
			return { ok: false, text: null };
		}
	};

	const checkLlms = async (): Promise<boolean> => {
		try {
			return llmsTxtLooksValid(await fetch(new URL('/llms.txt', finalUrl).href));
		} catch {
			return false;
		}
	};

	const [linkResults, robots, llmsTxtOk] = await Promise.all([
		mapLimit(sameOriginLinks, 4, head),
		checkRobots(),
		checkLlms()
	]);

	const sitemap = await discoverSitemapLocs(finalUrl, robots.text, head, fetch);

	return {
		brokenCount: linkResults.filter((r) => !r).length,
		checkedCount: sameOriginLinks.length,
		robotsOk: robots.ok,
		sitemapOk: sitemap.ok,
		llmsTxtOk,
		robotsText: robots.text,
		sitemapSample: sitemap.sample,
		sitemapLocs: sitemap.locs
	};
}

/** Parse `Sitemap:` directives from robots.txt (case-insensitive, same-origin only). */
export function extractRobotsSitemapUrls(robotsText: string | null, finalUrl: URL): string[] {
	if (!robotsText) return [];
	const urls: string[] = [];
	const seen = new Set<string>();
	for (const line of robotsText.split(/\r?\n/)) {
		const match = line.match(/^\s*sitemap\s*:\s*(.+)\s*$/i);
		if (!match) continue;
		try {
			const url = new URL(match[1].trim(), finalUrl);
			if (url.origin !== finalUrl.origin) continue;
			if (seen.has(url.href)) continue;
			seen.add(url.href);
			urls.push(url.href);
		} catch {
			// skip malformed entries
		}
	}
	return urls;
}

/**
 * Discover sitemap URLs from robots.txt plus the default /sitemap.xml, merge
 * same-origin locs (deduped), and sample a few for reachability.
 */
export async function discoverSitemapLocs(
	finalUrl: URL,
	robotsText: string | null,
	head: ScanDeps['headOk'],
	fetch: ScanDeps['fetchText']
): Promise<{
	ok: boolean;
	sample: { checked: number; broken: number } | null;
	locs: string[];
}> {
	try {
		const defaultSitemap = new URL('/sitemap.xml', finalUrl).href;
		const sitemapUrls = [
			...new Set([defaultSitemap, ...extractRobotsSitemapUrls(robotsText, finalUrl)])
		];

		const headResults = await Promise.all(sitemapUrls.map((url) => head(url)));
		if (!headResults.some(Boolean)) return { ok: false, sample: null, locs: [] };

		const allLocs: string[] = [];
		const seenLocs = new Set<string>();

		for (let i = 0; i < sitemapUrls.length; i += 1) {
			if (!headResults[i]) continue;
			const xml = await fetch(sitemapUrls[i]);
			if (!xml) continue;
			const locs = await collectSitemapLocs(
				xml,
				finalUrl,
				fetch,
				MAX_SITEMAP_LOCS - allLocs.length
			);
			for (const loc of locs) {
				if (seenLocs.has(loc)) continue;
				seenLocs.add(loc);
				allLocs.push(loc);
				if (allLocs.length >= MAX_SITEMAP_LOCS) break;
			}
			if (allLocs.length >= MAX_SITEMAP_LOCS) break;
		}

		if (allLocs.length === 0) return { ok: true, sample: null, locs: [] };

		const sampleLocs = allLocs.slice(0, 3);
		const results = await mapLimit(sampleLocs, 3, head);
		const broken = results.filter((r) => !r).length;
		return { ok: true, sample: { checked: sampleLocs.length, broken }, locs: allLocs };
	} catch {
		return { ok: false, sample: null, locs: [] };
	}
}

/** Resolve urlset locs, following a sitemap index one level deep when needed. */
export async function collectSitemapLocs(
	xml: string,
	finalUrl: URL,
	fetch: ScanDeps['fetchText'],
	max = MAX_SITEMAP_LOCS
): Promise<string[]> {
	if (/<sitemapindex/i.test(xml)) {
		const childSitemaps: string[] = [];
		for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
			const raw = match[1].replace(/&amp;/g, '&');
			try {
				const url = new URL(raw);
				if (url.origin !== finalUrl.origin) continue;
				childSitemaps.push(url.href);
				if (childSitemaps.length >= MAX_SITEMAP_INDEX_CHILDREN) break;
			} catch {
				// skip malformed entries
			}
		}

		const locs: string[] = [];
		for (const childUrl of childSitemaps) {
			const childXml = await fetch(childUrl);
			if (!childXml) continue;
			for (const loc of extractSitemapLocs(childXml, finalUrl, max - locs.length)) {
				locs.push(loc);
				if (locs.length >= max) return locs;
			}
		}
		return locs;
	}

	return extractSitemapLocs(xml, finalUrl, max);
}

/** First few same-origin URLs listed in a sitemap (or child sitemaps of an index). */
export function extractSitemapLocs(xml: string, finalUrl: URL, max = 3): string[] {
	const locs: string[] = [];
	for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
		const raw = match[1].replace(/&amp;/g, '&');
		try {
			const url = new URL(raw);
			if (url.origin !== finalUrl.origin) continue;
			locs.push(url.href);
			if (locs.length >= max) break;
		} catch {
			// skip malformed entries
		}
	}
	return locs;
}

/**
 * Does the other spelling of the domain (www ↔ apex) resolve and land on the
 * canonical origin? Skipped (null) for deeper subdomains where no obvious
 * sibling exists.
 */
export async function checkHostConsistency(
	finalUrl: URL,
	fetchHtml: ScanDeps['fetchHtml']
): Promise<{ altHost: string; resolves: boolean; sameSite: boolean } | null> {
	const host = finalUrl.hostname;
	let altHost: string;
	if (host.startsWith('www.')) {
		altHost = host.slice(4);
	} else if (host.split('.').length === 2) {
		altHost = `www.${host}`;
	} else {
		return null;
	}

	try {
		const altUrl = new URL(finalUrl.href);
		altUrl.hostname = altHost;
		altUrl.pathname = '/';
		altUrl.search = '';
		const result = await fetchHtml(altUrl);
		const canonicalHost = host.replace(/^www\./, '');
		const landedHost = result.finalUrl.hostname.replace(/^www\./, '');
		return {
			altHost,
			resolves: result.status >= 200 && result.status < 400,
			sameSite: landedHost === canonicalHost
		};
	} catch {
		return { altHost, resolves: false, sameSite: false };
	}
}

/** Fetch a path that cannot exist; a 2xx answer means the site soft-404s. */
export async function probeNotFound(
	finalUrl: URL,
	fetch: ScanDeps['fetchHtml']
): Promise<number | null> {
	try {
		const probeUrl = new URL(`/preflight-missing-${Date.now().toString(36)}`, finalUrl);
		const { status } = await fetch(probeUrl);
		return status;
	} catch {
		return null;
	}
}

/** SPF on the site's domain (falling back to the apex), DMARC alongside it. */
export async function checkEmailAuth(
	hostname: string,
	resolve: NonNullable<ScanDeps['resolveTxt']>
): Promise<{ spf: boolean; dmarc: boolean; domain: string } | null> {
	try {
		const domain = hostname.replace(/^www\./i, '');
		const labels = domain.split('.');
		const apex = labels.length > 2 ? labels.slice(-2).join('.') : null;
		const candidates = apex && apex !== domain ? [domain, apex] : [domain];

		const hasSpf = async (d: string) => (await resolve(d)).some((r) => /^v=spf1\b/i.test(r));
		const hasDmarc = async (d: string) =>
			(await resolve(`_dmarc.${d}`)).some((r) => /^v=DMARC1\b/i.test(r));

		let spf = false;
		let dmarc = false;
		let matched = domain;
		for (const candidate of candidates) {
			const [s, d] = await Promise.all([hasSpf(candidate), hasDmarc(candidate)]);
			if (s || d) matched = candidate;
			spf = spf || s;
			dmarc = dmarc || d;
			if (spf && dmarc) break;
		}
		return { spf, dmarc, domain: matched };
	} catch {
		return null;
	}
}

export async function checkOgImageLive(
	html: string,
	finalUrl: URL,
	probe: ScanDeps['headProbe']
): Promise<{ ok: boolean | null; probe: OgImageProbe }> {
	const raw = pickMeta(html, 'og:image');
	if (!raw?.trim())
		return { ok: null, probe: { reachable: null, isImage: null, contentType: null } };
	try {
		const imageUrl = assertPublicHttpUrl(new URL(raw, finalUrl).href);
		const result = await probe(imageUrl.href);
		const ok = result.reachable === true && result.isImage !== false;
		return { ok, probe: result };
	} catch {
		return { ok: false, probe: { reachable: false, isImage: null, contentType: null } };
	}
}
