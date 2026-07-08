import { describe, expect, it } from 'vitest';

import {
	DEFAULT_DEPLOYLINT_API,
	DEPLOYLINT_HOST,
	DEPLOYLINT_LEGACY_HOST,
	DEPLOYLINT_WWW_HOST
} from './index.js';

describe('@vibe/deploylint-shared runtime contract', () => {
	it('exports one canonical production API origin', () => {
		const api = new URL(DEFAULT_DEPLOYLINT_API);

		expect(api.protocol).toBe('https:');
		expect(api.hostname).toBe(DEPLOYLINT_HOST);
		expect(api.pathname).toBe('/');
		expect(DEFAULT_DEPLOYLINT_API.endsWith('/')).toBe(false);
	});

	it('keeps public host constants distinct and production-safe', () => {
		const hosts = [DEPLOYLINT_HOST, DEPLOYLINT_WWW_HOST, DEPLOYLINT_LEGACY_HOST];

		expect(new Set(hosts).size).toBe(hosts.length);
		expect(hosts).not.toContain('preflight.pages.dev');
		for (const host of hosts) {
			expect(host).not.toContain('localhost');
			expect(host).not.toMatch(/\s/);
		}
	});
});
