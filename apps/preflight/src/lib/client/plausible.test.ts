import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadPlausible(browser: boolean) {
	vi.resetModules();
	vi.doMock('$app/environment', () => ({
		browser
	}));
	return import('./plausible');
}

function stubWindow(value: Partial<Window>) {
	vi.stubGlobal('window', value);
	return value;
}

function runTimer(handler: TimerHandler | null) {
	if (typeof handler === 'function') handler();
}

afterEach(() => {
	vi.doUnmock('$app/environment');
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('plausibleInitSnippet', () => {
	it('matches Plausible personalized script init with no explicit options', async () => {
		const { plausibleInitSnippet } = await loadPlausible(false);

		const snippet = plausibleInitSnippet();

		expect(snippet).toContain('window.plausible=window.plausible||function()');
		expect(snippet).toContain('plausible.init=plausible.init||function(i)');
		expect(snippet).toContain('plausible.init()');
		expect(snippet).not.toContain('"domain"');
		expect(snippet).not.toContain('"endpoint"');
	});
});

describe('Plausible client event bridge', () => {
	it('does nothing while server-rendering', async () => {
		const { isPlausibleReady, trackPlausibleEvent, watchPlausible } = await loadPlausible(false);

		expect(() => watchPlausible()).not.toThrow();
		trackPlausibleEvent('scan_completed', { score: 90 });

		expect(isPlausibleReady()).toBe(false);
	});

	it('dispatches immediately when the Plausible function is already loaded', async () => {
		const plausible = vi.fn<NonNullable<Window['plausible']>>();
		stubWindow({ plausible });
		const { isPlausibleReady, trackPlausibleEvent } = await loadPlausible(true);

		trackPlausibleEvent('scan_completed', {
			score: 90,
			unlocked: true,
			verdict: 'go'
		});

		expect(isPlausibleReady()).toBe(true);
		expect(plausible).toHaveBeenCalledWith('scan_completed', {
			props: { score: '90', unlocked: 'true', verdict: 'go' }
		});
	});

	it('queues events until the deferred Plausible script is ready', async () => {
		let intervalHandler: TimerHandler | null = null;
		const plausible = vi.fn<NonNullable<Window['plausible']>>();
		const clearInterval = vi.fn<Window['clearInterval']>();
		const windowStub = stubWindow({
			plausible: undefined,
			setInterval: vi.fn<Window['setInterval']>((handler: TimerHandler) => {
				intervalHandler = handler;
				return 1;
			}),
			clearInterval
		});
		const { isPlausibleReady, trackPlausibleEvent } = await loadPlausible(true);

		trackPlausibleEvent('unlock_click', { plan: 'solo' });

		expect(isPlausibleReady()).toBe(false);
		expect(plausible).not.toHaveBeenCalled();

		windowStub.plausible = plausible;
		runTimer(intervalHandler);

		expect(isPlausibleReady()).toBe(true);
		expect(plausible).toHaveBeenCalledWith('unlock_click', { props: { plan: 'solo' } });
	});

	it('stops polling when Plausible never loads', async () => {
		let intervalHandler: TimerHandler | null = null;
		const clearInterval = vi.fn<Window['clearInterval']>();
		stubWindow({
			plausible: undefined,
			setInterval: vi.fn<Window['setInterval']>((handler: TimerHandler) => {
				intervalHandler = handler;
				return 7;
			}),
			clearInterval
		});
		vi.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(11_050);
		const { isPlausibleReady, watchPlausible } = await loadPlausible(true);

		watchPlausible();
		runTimer(intervalHandler);

		expect(isPlausibleReady()).toBe(false);
		expect(clearInterval).toHaveBeenCalledWith(7);
	});
});
