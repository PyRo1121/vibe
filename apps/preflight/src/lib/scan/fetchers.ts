import type { OgImageProbe } from '$lib/scan/checks/context';
import {
	FETCH_TIMEOUT_MS,
	MAX_HTML_BYTES,
	MAX_REDIRECTS,
	MAX_SCRIPT_BYTES,
	USER_AGENT
} from '$lib/scan/constants';
import { pickSecurityHeaders } from '$lib/scan/headers';
import { isImageContentType } from '$lib/scan/signals';
import {
	assertPublicHttpUrl,
	assertPublicResolvedUrl,
	type DnsResolver
} from '$lib/scan/url-guard';

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

interface BuildScanDepsOptions {
	maxHtmlBytes?: number;
	maxScriptBytes?: number;
}

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
				const requestInit: RequestInit & { duplex?: 'half' } = {
					method: input.method,
					headers: input.headers,
					body: input.method === 'GET' || input.method === 'HEAD' ? undefined : input.body,
					redirect: init?.redirect ?? input.redirect,
					signal: init?.signal ?? input.signal
				};
				if (requestInit.body) requestInit.duplex = 'half';
				return self.fetch(new Request(internalUrl, requestInit));
			}
			return self.fetch(internalUrl, init);
		}
		return externalFetch(input, init);
	};
}

async function discardBody(res: Response): Promise<void> {
	try {
		await res.body?.cancel();
	} catch {
		/* body already consumed or closed */
	}
}

export async function readBoundedText(
	res: Response,
	maxBytes: number
): Promise<{ text: string; truncated: boolean }> {
	if (!res.body) {
		const text = await res.text();
		return {
			text: text.slice(0, maxBytes),
			truncated: new TextEncoder().encode(text).byteLength > maxBytes
		};
	}

	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	let truncated = false;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const chunk = value ?? new Uint8Array();
		const remaining = maxBytes - total;
		if (remaining <= 0 || chunk.byteLength > remaining) {
			if (remaining > 0) {
				chunks.push(chunk.slice(0, remaining));
				total += remaining;
			}
			truncated = true;
			await reader.cancel();
			break;
		}
		chunks.push(chunk);
		total += chunk.byteLength;
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return { text: new TextDecoder('utf-8').decode(bytes), truncated };
}

export function buildScanDeps(
	siteFetch: SiteFetch,
	resolveAddresses: DnsResolver = resolvePublicAddresses,
	opts: BuildScanDepsOptions = {}
): ScanDeps {
	const maxHtmlBytes = opts.maxHtmlBytes ?? MAX_HTML_BYTES;
	const maxScriptBytes = opts.maxScriptBytes ?? MAX_SCRIPT_BYTES;

	async function followRedirects(
		startUrl: URL,
		init: RequestInit
	): Promise<{ res: Response; finalUrl: URL; redirectHops: number } | null> {
		let current = await assertPublicResolvedUrl(
			assertPublicHttpUrl(startUrl.href),
			resolveAddresses
		);
		let redirectHops = 0;

		for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
			const res = await siteFetch(current.href, { ...init, redirect: 'manual' });

			if (res.status >= 300 && res.status < 400) {
				const location = res.headers.get('location');
				if (!location) return null;
				await discardBody(res);
				current = await assertPublicResolvedUrl(new URL(location, current), resolveAddresses);
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
			const { text } = await readBoundedText(res, maxHtmlBytes);

			return {
				html: text,
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
			await discardBody(getResult.res);
			const getStatus = getResult.res.status;
			if (getStatus >= 200 && getStatus < 400) return true;
			return getStatus === 401 || getStatus === 403 || getStatus === 429 || getStatus === 503;
		} catch {
			return false;
		}
	}

	async function headProbe(rawUrl: string): Promise<OgImageProbe> {
		try {
			const url = assertPublicHttpUrl(rawUrl);
			const result = await followRedirects(url, {
				method: 'HEAD',
				signal: AbortSignal.timeout(8000),
				headers: { 'User-Agent': USER_AGENT }
			});

			if (result && result.res.status < 400) {
				const contentType = result.res.headers.get('content-type');
				return {
					reachable: true,
					contentType,
					isImage: isImageContentType(contentType)
				};
			}
			if (result?.res.status === 404 || result?.res.status === 410) {
				return { reachable: false, isImage: null, contentType: null };
			}

			const getResult = await followRedirects(url, {
				method: 'GET',
				signal: AbortSignal.timeout(8000),
				headers: { Accept: 'image/*,*/*', 'User-Agent': USER_AGENT }
			});
			if (!getResult || getResult.res.status >= 400) {
				return { reachable: false, isImage: null, contentType: null };
			}

			const contentType = getResult.res.headers.get('content-type');
			await discardBody(getResult.res);
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

			const { text, truncated } = await readBoundedText(result.res, maxScriptBytes);
			if (truncated) return null;

			return text;
		} catch {
			return null;
		}
	}

	return { fetchHtml, headOk, headProbe, fetchText, resolveTxt };
}

async function resolvePublicAddresses(name: string): Promise<string[]> {
	const lookup = async (type: 'A' | 'AAAA') => {
		const res = await fetch(
			`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
			{ headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(6000) }
		);
		if (!res.ok) return [];
		const body = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
		const expectedType = type === 'A' ? 1 : 28;
		return (body.Answer ?? [])
			.filter((answer) => answer.type === expectedType)
			.map((answer) => answer.data);
	};

	try {
		const [a, aaaa] = await Promise.all([lookup('A'), lookup('AAAA')]);
		return [...a, ...aaaa];
	} catch {
		return [];
	}
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
			.map((a) => a.data.replaceAll(/^"|"$/g, '').replaceAll(/"\s*"/g, ''));
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
