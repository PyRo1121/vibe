import { normalizeProjectId } from '$lib/product/project-id';
import { UrlValidationError, assertPublicHttpUrl } from '$lib/scan/url-guard';

export interface ScanRequestBody {
	url?: string;
	unlockSessionId?: string;
	previousScore?: number;
	projectId?: string;
	ingestToken?: string;
	commitSha?: string;
	branch?: string;
	pullRequest?: string;
}

export function parseScanRequestBody(body: unknown): {
	url: string;
	unlockSessionId?: string;
	previousScore?: number;
	projectId?: string;
	ingestToken?: string;
	commitSha?: string;
	branch?: string;
	pullRequest?: string;
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
	const projectId = normalizeProjectId(record.projectId);
	const ingestToken = cleanCiContext(record.ingestToken, 128);

	return {
		url,
		unlockSessionId: unlockSessionId || undefined,
		previousScore,
		projectId,
		ingestToken,
		commitSha: cleanCiContext(record.commitSha, 80),
		branch: cleanCiContext(record.branch, 120),
		pullRequest: cleanCiContext(record.pullRequest, 40)
	};
}

function cleanCiContext(value: unknown, maxLength: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const clean = value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
	return clean || undefined;
}

export function assertJsonBodySize(contentLength: string | null, maxBytes = 4096): void {
	if (!contentLength) return;
	const size = Number.parseInt(contentLength, 10);
	if (Number.isFinite(size) && size > maxBytes) {
		throw new UrlValidationError('Request body too large');
	}
}
