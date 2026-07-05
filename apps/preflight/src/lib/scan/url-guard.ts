import { normalizeUrl } from '$lib/scan/parse';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata.goog']);

export type DnsResolver = (hostname: string) => Promise<string[]>;

export class UrlValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UrlValidationError';
	}
}

function parseIpv4(host: string): number[] | null {
	const parts = host.split('.');
	if (parts.length !== 4) return null;
	const nums = parts.map((p) => Number.parseInt(p, 10));
	if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
	return nums;
}

function isPrivateIpv4(octets: number[]): boolean {
	const [a, b] = octets;
	if (a === 127) return true;
	if (a === 10) return true;
	if (a === 0) return true;
	if (a === 169 && b === 254) return true;
	if (a === 192 && b === 168) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	// CGNAT / shared address space (RFC 6598)
	if (a === 100 && b >= 64 && b <= 127) return true;
	// Benchmarking (RFC 2544)
	if (a === 198 && b >= 18 && b <= 19) return true;
	return false;
}

function isPrivateIpv6(host: string): boolean {
	const h = host.toLowerCase().replaceAll(/^\[|\]$/g, '');
	if (h === '::1') return true;
	const mappedIpv4 = h.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
	if (mappedIpv4) {
		const ipv4 = parseIpv4(mappedIpv4[1]);
		return ipv4 ? isPrivateIpv4(ipv4) : true;
	}
	if (h.startsWith('fc') || h.startsWith('fd')) return true;
	if (h.startsWith('fe80')) return true;
	return false;
}

function isBlockedHost(host: string): boolean {
	const lower = host
		.toLowerCase()
		.replace(/\.$/, '')
		.replaceAll(/^\[|\]$/g, '');
	if (BLOCKED_HOSTS.has(lower)) return true;
	if (lower.endsWith('.localhost')) return true;
	if (lower.endsWith('.local')) return true;
	if (lower.endsWith('.internal')) return true;
	if (lower.endsWith('.intranet')) return true;

	const ipv4 = parseIpv4(lower);
	if (ipv4) return isPrivateIpv4(ipv4);

	if (lower.includes(':')) return isPrivateIpv6(lower);

	return false;
}

/** Validates URL is HTTPS and not an obvious SSRF/internal target. */
export function assertPublicHttpUrl(raw: string): URL {
	let url: URL;
	try {
		url = normalizeUrl(raw);
	} catch {
		throw new UrlValidationError('Invalid URL');
	}

	if (url.protocol !== 'https:') {
		throw new UrlValidationError('Only HTTPS URLs are allowed');
	}

	if (url.username || url.password) {
		throw new UrlValidationError('URLs with credentials are not allowed');
	}

	if (isBlockedHost(url.hostname)) {
		throw new UrlValidationError('That URL cannot be scanned');
	}

	return url;
}

export async function assertPublicResolvedUrl(url: URL, resolver: DnsResolver): Promise<URL> {
	const checked = assertPublicHttpUrl(url.href);
	const resolved = await resolver(checked.hostname);
	if (resolved.length === 0) {
		throw new UrlValidationError('That URL cannot be scanned');
	}
	for (const address of resolved) {
		if (isBlockedHost(address)) {
			throw new UrlValidationError('That URL cannot be scanned');
		}
	}
	return checked;
}

export function isPublicHttpUrl(raw: string): boolean {
	try {
		assertPublicHttpUrl(raw);
		return true;
	} catch {
		return false;
	}
}
