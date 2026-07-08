import { afterEach, describe, expect, it, vi } from 'vitest';

type IsPlausibleReady = typeof import('$lib/client/plausible').isPlausibleReady;
type TrackPlausibleEvent = typeof import('$lib/client/plausible').trackPlausibleEvent;

vi.mock('$lib/client/plausible', () => ({
	isPlausibleReady: vi.fn<IsPlausibleReady>(),
	trackPlausibleEvent: vi.fn<TrackPlausibleEvent>()
}));

import { isPlausibleReady, trackPlausibleEvent } from '$lib/client/plausible';

import { trackFunnel } from './track';

const isPlausibleReadyMock = vi.mocked(isPlausibleReady);
const trackPlausibleEventMock = vi.mocked(trackPlausibleEvent);

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe('trackFunnel', () => {
	it('posts funnel events and forwards Plausible props when ready', () => {
		const fetchMock = vi.fn<Window['fetch']>(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('window', {});
		vi.stubGlobal('fetch', fetchMock);
		isPlausibleReadyMock.mockReturnValue(true);

		trackFunnel('scan_completed', {
			score: 88,
			verdict: 'review',
			unlocked: false,
			plan: 'solo',
			scoreDelta: undefined
		});

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/events',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event: 'scan_completed',
					score: 88,
					verdict: 'review',
					unlocked: false,
					plan: 'solo'
				}),
				keepalive: true
			})
		);
		expect(trackPlausibleEventMock).toHaveBeenCalledWith('scan_completed', {
			score: 88,
			verdict: 'review',
			unlocked: false,
			plan: 'solo'
		});
	});

	it('queues Plausible funnel events through the Plausible client before it is ready', () => {
		const fetchMock = vi.fn<Window['fetch']>(async () => new Response(null, { status: 204 }));
		vi.stubGlobal('window', {});
		vi.stubGlobal('fetch', fetchMock);
		isPlausibleReadyMock.mockReturnValue(false);

		trackFunnel('pricing_viewed', {
			mode: 'paid',
			plan: 'builder'
		});

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(trackPlausibleEventMock).toHaveBeenCalledWith('pricing_viewed', {
			mode: 'paid',
			plan: 'builder'
		});
	});

	it('does nothing during server rendering', () => {
		const fetchMock = vi.fn<Window['fetch']>();
		vi.stubGlobal('fetch', fetchMock);

		trackFunnel('pricing_viewed', { mode: 'paid' });

		expect(fetchMock).not.toHaveBeenCalled();
		expect(isPlausibleReadyMock).not.toHaveBeenCalled();
		expect(trackPlausibleEventMock).not.toHaveBeenCalled();
	});
});
