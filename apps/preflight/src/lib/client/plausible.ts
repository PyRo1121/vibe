import { browser } from '$app/environment';

type PlausibleTrack = (event: string, options: { props?: Record<string, string> }) => void;

let started = false;
let trackFn: PlausibleTrack | null = null;

/** Client-only Plausible init — official NPM integration for SPAs with SSR. */
export async function startPlausible(domain: string): Promise<void> {
	if (!browser || started || !domain.trim()) return;

	const { init, track } = await import('@plausible-analytics/tracker');
	init({
		domain: domain.trim(),
		autoCapturePageviews: true,
		bindToWindow: true
	});
	trackFn = track;
	started = true;
}

export function isPlausibleReady(): boolean {
	return started;
}

export function trackPlausibleEvent(
	event: string,
	props?: Record<string, string | number | boolean>
): void {
	if (!trackFn) return;

	const plausibleProps: Record<string, string> = {};
	if (props) {
		for (const [key, value] of Object.entries(props)) {
			plausibleProps[key] = String(value);
		}
	}

	trackFn(event, Object.keys(plausibleProps).length > 0 ? { props: plausibleProps } : {});
}
