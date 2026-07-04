import {
	FETCH_TIMEOUT_MS,
	MAX_HTML_BYTES,
	MAX_REDIRECTS,
	MAX_SCRIPT_BYTES,
	USER_AGENT
} from '$lib/scan/constants';
import type { OgImageProbe } from '$lib/scan/checks/context';
import { pickSecurityHeaders } from '$lib/scan/headers';
import { isImageContentType } from '$lib/scan/signals';
import { assertPublicHttpUrl } from '$lib/scan/url-guard';

/**
 * Network layer for the site scanner. Every function here is injectable via
 * ScanDeps so the engine and its tests never depend on live fetches.
 */

export interface FetchHtmlResult {
	html: string;
	finalUrl: URL;
	status: number;
	headers: ReturnType<typeof pickSecurityHeaders>;
	redirectHops: number;
}

export interface ScanDeps {
	fetchHtml: (url: URL) => Promise<FetchHtmlResult>;
	headOk: (url: string) => Promise<boolean>;
	headProbe: (url: string) => Promise<OgImageProbe>;
	fetchText: (url: string) => Promise<string | null>;
	/** TXT record lookup for SPF/DMARC. Optional — email check is skipped without it. */
	resolveTxt?: (name: string) => Promise<string[]>;
}

type SiteFetch = typeof fetch;

/** Hostname of PUBLIC_APP_URL — used to route same-zone fetches through the SELF binding. */
export function appHostname(appUrl: string | undefined): string | null {
	if (!appUrl?.trim()) return null;
	try {
		return new URL(appUrl.trim()).hostname;
	} catch {
		return null;
	}
}

function toAbsoluteUrl(input: RequestInfo | URL): URL | null {
	try {
		if (input instanceof Request) return new URL(input.url);
		if (input instanceof URL) return input;
		return new URL(input);
	} catch {
		return null;
	}
}

/**
 * Cloudflare Workers return 522 when a worker fetches its own custom domain.
 * Service-binding fetches bypass the edge loop — pathname + query are enough.
 */
export function wrapSameZoneFetch(
	self: Fetcher,
	appHost: string,
	externalFetch: SiteFetch = fetch
): SiteFetch {
	const internalOrigin = 'https://preflight.internal';

	return (input, init) => {
		const url = toAbsoluteUrl(input);
		if (url?.hostname === appHost) {
			const path = url.pathname + url.search;
			const internalUrl = `${internalOrigin}${path}`;
			if (input instanceof Request) {
				return self.fetch(
					new Request(internalUrl, {
						method: input.method,
						headers: input.headers,
						body: input.method === 'GET' || input.method === 'HEAD' ? undefined : input.body,
						redirect: init?.redirect ?? input.redirect,
						signal: init?.signal ?? input.signal
					})
				);
			}
			return self.fetch(internalUrl, init);
		}
		return externalFetch(input, init);
	};
}

function buildScanDeps(siteFetch: SiteFetch): ScanDeps {
	async function followRedirects(
		startUrl: URL,
		init: RequestInit
	): Promise<{ res: Response; finalUrl: URL; redirectHops: number } | null> {
		let current = assertPublicHttpUrl(startUrl.href);
		let redirectHops = 0;

		for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
			const res = await siteFetch(current.href, { ...init, redirect: 'manual' });

			if (res.status >= 300 && res.status < 400) {
				const location = res.headers.get('location');
				if (!location) return null;
				current = assertPublicHttpUrl(new URL(location, current).href);
				redirectHops += 1;
				continue;
			}

			return { res, finalUrl: current, redirectHops };
		}

		return null;
	}

	async function fetchHtml(startUrl: URL): Promise<FetchHtmlResult> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		try {
			const result = await followRedirects(startUrl, {
				signal: controller.signal,
				headers: {
					Accept: 'text/html,application/xhtml+xml',
					'User-Agent': USER_AGENT
				}
			});

			if (!result) throw new Error('Too many redirects');

			const { res, finalUrl } = result;
			const buf = await res.arrayBuffer();
			const capped = buf.byteLength > MAX_HTML_BYTES ? buf.slice(0, MAX_HTML_BYTES) : buf;

			return {
				html: new TextDecoder('utf-8').decode(capped),
				finalUrl,
				status: res.status,
				headers: pickSecurityHeaders(res),
				redirectHops: result.redirectHops
			};
		} finally {
			clearTimeout(timer);
		}
	}

	async function headOk(rawUrl: string): Promise<boolean> {
		try {
			const url = assertPublicHttpUrl(rawUrl);
			const result = await followRedirects(url, {
				method: 'HEAD',
				signal: AbortSignal.timeout(8000),
				headers: { 'User-Agent': USER_AGENT }
			});
			const status = result?.res.status ?? 0;
			if (status >= 200 && status < 400) return true;
			if (status === 404 || status === 410) return false;

			const getResult = await followRedirects(url, {
				method: 'GET',
				signal: AbortSignal.timeout(8000),
				headers: { 'User-Agent': USER_AGENT }
			});
			if (!getResult) return false;
			try {
				await getResult.res.body?.cancel();
			} catch {
				/* body already consumed or closed */
			}
			const getStatus = getResult.res.status;
			if (getStatus >= 200 && getStatus < 400) return true;
			return getStatus === 401 || getStatus === 403 || getStatus === 429 || getStatus === 503;
		} catch {
			return false;
		}
	}

	async function headProbe(rawUrl: string): Promise<OgImageProbe> {
		try {
			const result = await followRedirects(assertPublicHttpUrl(rawUrl), {
				method: 'HEAD',
				signal: AbortSignal.timeout(8000),
				headers: { 'User-Agent': USER_AGENT }
			});
			if (!result || result.res.status >= 400) {
				return { reachable: false, isImage: null, contentType: null };
			}
			const contentType = result.res.headers.get('content-type');
			return {
				reachable: true,
				contentType,
				isImage: isImageContentType(contentType)
			};
		} catch {
			return { reachable: false, isImage: null, contentType: null };
		}
	}

	async function fetchText(rawUrl: string): Promise<string | null> {
		try {
			const result = await followRedirects(assertPublicHttpUrl(rawUrl), {
				signal: AbortSignal.timeout(8000),
				headers: {
					Accept: 'text/plain,text/html,application/javascript,text/javascript,*/*',
					'User-Agent': USER_AGENT
				}
			});

			if (!result || result.res.status >= 400) return null;

			const buf = await result.res.arrayBuffer();
			if (buf.byteLength > MAX_SCRIPT_BYTES) return null;

			return new TextDecoder('utf-8').decode(buf);
		} catch {
			return null;
		}
	}

	return { fetchHtml, headOk, headProbe, fetchText, resolveTxt };
}

/** TXT lookup via Cloudflare DNS-over-HTTPS — always external, never same-zone. */
async function resolveTxt(name: string): Promise<string[]> {
	try {
		const res = await fetch(
			`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
			{ headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(6000) }
		);
		if (!res.ok) return [];
		const body = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
		return (body.Answer ?? [])
			.filter((a) => a.type === 16)
			.map((a) => a.data.replace(/^"|"$/g, '').replace(/"\s*"/g, ''));
	} catch {
		return [];
	}
}

export const defaultDeps: ScanDeps = buildScanDeps(fetch);

/** Production deps — routes same-zone fetches through the SELF service binding when configured. */
export function createScanDeps(env?: Env): ScanDeps {
	const host = appHostname(env?.PUBLIC_APP_URL);
	if (!env?.SELF || !host) return defaultDeps;
	return buildScanDeps(wrapSameZoneFetch(env.SELF, host));
}
