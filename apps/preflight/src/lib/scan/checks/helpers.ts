import type { ScanCheck } from '$lib/scan/types';

/** Shared context passed to every check builder — the scanned page's URL. */
export interface CheckCtx {
	url: string;
}

export function lengthStatus(len: number, passMax: number): ScanCheck['status'] {
	return len <= passMax ? 'pass' : 'warn';
}

export function tierFromCount(count: number): ScanCheck['status'] {
	if (count === 0) return 'pass';
	if (count <= 2) return 'warn';
	return 'fail';
}

export function pagePath(url: string): string {
	try {
		return new URL(url).pathname || '/';
	} catch {
		return url;
	}
}
