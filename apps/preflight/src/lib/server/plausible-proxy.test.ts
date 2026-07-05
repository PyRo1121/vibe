import { describe, expect, it } from 'vitest';

import { plausibleUpstreamScript, proxyPlausibleScript } from './plausible-proxy';

describe('plausibleUpstreamScript', () => {
	it('falls back to default script URL', () => {
		expect(plausibleUpstreamScript()).toBe('https://plausible.io/js/script.js');
	});

	it('uses env override', () => {
		expect(
			plausibleUpstreamScript({ PUBLIC_PLAUSIBLE_SCRIPT: 'https://plausible.io/js/pa-test.js' })
		).toBe('https://plausible.io/js/pa-test.js');
	});
});

describe('proxyPlausibleScript', () => {
	it('returns javascript content-type', async () => {
		const res = await proxyPlausibleScript('https://plausible.io/js/script.js');
		expect(res.headers.get('Content-Type')).toContain('javascript');
	});

	it('uses a long cache lifetime for the stable first-party script proxy', async () => {
		const res = await proxyPlausibleScript('https://plausible.io/js/script.js');
		expect(res.headers.get('Cache-Control')).toBe(
			'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400'
		);
	});
});
