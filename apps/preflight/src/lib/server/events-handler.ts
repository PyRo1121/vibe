import { isFunnelEventName, logFunnelEvent, sanitizeFunnelPayload } from '$lib/metrics/funnel';
import { UrlValidationError } from '$lib/scan/url-guard';
import { readJsonBody } from '$lib/server/api';
import { json } from '@sveltejs/kit';

function isAbortNoise(err: unknown): boolean {
	return err instanceof Error && /\baborted\b/i.test(err.message);
}

export async function handleEventsPost(request: Request) {
	let body: unknown;
	try {
		body = await readJsonBody(request, 2048);
	} catch (err) {
		if (isAbortNoise(err)) return new Response(null, { status: 204 });
		throw err;
	}

	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new UrlValidationError('Invalid event body');
	}

	const raw = body as Record<string, unknown>;
	const event = raw.event;
	if (typeof event !== 'string' || !isFunnelEventName(event)) {
		throw new UrlValidationError('Unknown event');
	}

	const payload = sanitizeFunnelPayload(raw);
	logFunnelEvent(event, payload);
	return json({ ok: true });
}
