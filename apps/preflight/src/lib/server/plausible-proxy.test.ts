import { describe, expect, it } from 'vitest';
import { plausibleUpstreamScript, proxyPlausibleScript } from './plausible-proxy';

describe('plausibleUpstreamScript', () => {
	it('falls back to default script URL', () => {
		expect(plausibleUpstreamScript(undefined)).toBe('https://plausible.io/js/script.js');
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
});
