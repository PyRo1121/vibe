import { browser } from '$app/environment';

type PlausibleFn = (event: string, options?: { props?: Record<string, string> }) => void;

declare global {
	interface Window {
		plausible?: PlausibleFn;
	}
}

const POLL_MS = 50;
const POLL_TIMEOUT_MS = 10_000;

let watchStarted = false;
let ready = false;
const pending: Array<{ event: string; props?: Record<string, string> }> = [];

function flushPending(): void {
	if (!window.plausible) return;
	for (const { event, props } of pending.splice(0)) {
		window.plausible(event, props ? { props } : undefined);
	}
}

function markReady(): void {
	if (ready) return;
	ready = true;
	flushPending();
}

/** Inline init stub for SSR — verifier looks for plausible.init in page source. */
export function plausibleInitSnippet(domain: string, endpoint: string): string {
	const opts = JSON.stringify({ domain, endpoint });
	return `<script>window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init(${opts})</script>`;
}

/** Wait for the deferred Plausible script tag to expose window.plausible. */
export function watchPlausible(): void {
	if (!browser || watchStarted) return;
	watchStarted = true;

	const tick = () => {
		if (typeof window.plausible === 'function') markReady();
	};

	tick();
	if (ready) return;

	const started = Date.now();
	const id = window.setInterval(() => {
		tick();
		if (ready || Date.now() - started >= POLL_TIMEOUT_MS) window.clearInterval(id);
	}, POLL_MS);
}

export function isPlausibleReady(): boolean {
	return ready && typeof window.plausible === 'function';
}

export function trackPlausibleEvent(
	event: string,
	props?: Record<string, string | number | boolean>
): void {
	if (!browser) return;
	watchPlausible();

	const plausibleProps: Record<string, string> = {};
	if (props) {
		for (const [key, value] of Object.entries(props)) {
			plausibleProps[key] = String(value);
		}
	}

	const payload = Object.keys(plausibleProps).length > 0 ? plausibleProps : undefined;

	if (typeof window.plausible === 'function') {
		window.plausible(event, payload ? { props: payload } : undefined);
		return;
	}

	pending.push({ event, props: payload });
}
