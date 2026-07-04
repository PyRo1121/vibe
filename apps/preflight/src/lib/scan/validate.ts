import { UrlValidationError, assertPublicHttpUrl } from '$lib/scan/url-guard';

export interface ScanRequestBody {
	url?: string;
	unlockSessionId?: string;
	previousScore?: number;
}

export function parseScanRequestBody(body: unknown): {
	url: string;
	unlockSessionId?: string;
	previousScore?: number;
} {
	if (body === null || typeof body !== 'object') {
		throw new UrlValidationError('Invalid JSON body');
	}
	const record = body as ScanRequestBody;
	const url = record.url?.trim();
	if (!url) {
		throw new UrlValidationError('Missing url');
	}
	assertPublicHttpUrl(url);

	const unlockSessionId = record.unlockSessionId?.trim();
	const previousScore =
		typeof record.previousScore === 'number' && Number.isFinite(record.previousScore)
			? Math.round(record.previousScore)
			: undefined;

	return { url, unlockSessionId: unlockSessionId || undefined, previousScore };
}

export function assertJsonBodySize(contentLength: string | null, maxBytes = 4096): void {
	if (!contentLength) return;
	const size = Number.parseInt(contentLength, 10);
	if (Number.isFinite(size) && size > maxBytes) {
		throw new UrlValidationError('Request body too large');
	}
}
