import { UrlValidationError } from '$lib/scan/url-guard';
import { parseScanRequestBody } from '$lib/scan/validate';
import { error } from '@sveltejs/kit';

export function rejectValidation(err: unknown): never {
	if (err instanceof UrlValidationError) error(400, err.message);
	throw err;
}

export async function readJsonBody(request: Request, maxBytes = 4096): Promise<unknown> {
	const contentLength = request.headers.get('content-length');
	if (contentLength) {
		const size = Number.parseInt(contentLength, 10);
		if (Number.isFinite(size) && size > maxBytes) {
			throw new UrlValidationError('Request body too large');
		}
	}

	const text = await request.text();
	if (text.length > maxBytes) {
		throw new UrlValidationError('Request body too large');
	}

	try {
		return text ? JSON.parse(text) : null;
	} catch {
		throw new UrlValidationError('Invalid JSON body');
	}
}

export async function parseScanJsonBody(request: Request): Promise<{
	url: string;
	repoUrl?: string;
	unlockSessionId?: string;
	previousScore?: number;
	projectId?: string;
	ingestToken?: string;
	commitSha?: string;
	branch?: string;
	pullRequest?: string;
}> {
	const body = await readJsonBody(request);
	try {
		return parseScanRequestBody(body);
	} catch (err) {
		return rejectValidation(err);
	}
}
