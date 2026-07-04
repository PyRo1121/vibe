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

async function followRedirects(
	startUrl: URL,
	init: RequestInit
): Promise<{ res: Response; finalUrl: URL; redirectHops: number } | null> {
	let current = assertPublicHttpUrl(startUrl.href);
	let redirectHops = 0;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
		const res = await fetch(current.href, { ...init, redirect: 'manual' });

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
		// Huge marketing pages (linear.app ships >2MB of HTML) still deserve a
		// scan: analyze the first MAX_HTML_BYTES instead of refusing outright.
		// The page-weight check flags the size on its own.
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

		// Some servers reject HEAD (405) or bot-filter it (HN returns 4xx) —
		// confirm with GET before declaring the link dead.
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
		// Auth walls and rate limiters rejecting the scanner — the URL exists,
		// it just refuses bots. Only real not-found/server-error statuses count
		// as broken, otherwise we report phantom dead links on guarded sites.
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

/** TXT lookup via Cloudflare DNS-over-HTTPS — works inside Workers without sockets. */
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

export const defaultDeps: ScanDeps = {
	fetchHtml,
	headOk,
	headProbe,
	fetchText,
	resolveTxt
};
