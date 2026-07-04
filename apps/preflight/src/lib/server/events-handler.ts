import { json } from '@sveltejs/kit';
import { UrlValidationError } from '$lib/scan/url-guard';
import {
	isFunnelEventName,
	logFunnelEvent,
	sanitizeFunnelPayload,
	type FunnelEventName
} from '$lib/metrics/funnel';
import { readJsonBody } from '$lib/server/api';

export async function handleEventsPost(request: Request) {
	const body = await readJsonBody(request, 2048);
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new UrlValidationError('Invalid event body');
	}

	const raw = body as Record<string, unknown>;
	const event = raw.event;
	if (typeof event !== 'string' || !isFunnelEventName(event)) {
		throw new UrlValidationError('Unknown event');
	}

	const payload = sanitizeFunnelPayload(raw);
	logFunnelEvent(event as FunnelEventName, payload);
	return json({ ok: true });
}
