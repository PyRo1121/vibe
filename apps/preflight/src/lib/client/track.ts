import type { FunnelEventName, FunnelPayload } from '$lib/metrics/funnel';

declare global {
	interface Window {
		plausible?: (
			event: string,
			options?: { props?: Record<string, string | number | boolean> }
		) => void;
	}
}

/** Fire-and-forget funnel event for Phase 18 conversion tracking. */
export function trackFunnel(name: FunnelEventName, payload: FunnelPayload = {}): void {
	if (typeof window === 'undefined') return;

	void fetch('/api/events', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ event: name, ...payload }),
		keepalive: true
	}).catch(() => {});

	if (window.plausible) {
		const props: Record<string, string | number | boolean> = {};
		for (const [key, value] of Object.entries(payload)) {
			if (value !== undefined) props[key] = value;
		}
		window.plausible(name, Object.keys(props).length > 0 ? { props } : undefined);
	}
}
