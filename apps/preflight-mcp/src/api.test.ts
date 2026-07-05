import { DEFAULT_DEPLOYLINT_API } from '@vibe/deploylint-shared';
import { afterEach, describe, expect, it } from 'vitest';

import { apiBase } from './api.js';

const ORIGINAL_DEPLOYLINT_API = process.env.DEPLOYLINT_API;
const ORIGINAL_PREFLIGHT_API = process.env.PREFLIGHT_API;

afterEach(() => {
	process.env.DEPLOYLINT_API = ORIGINAL_DEPLOYLINT_API;
	process.env.PREFLIGHT_API = ORIGINAL_PREFLIGHT_API;
});

describe('apiBase', () => {
	it('uses the shared Deploylint API default when no override is configured', () => {
		delete process.env.DEPLOYLINT_API;
		delete process.env.PREFLIGHT_API;

		expect(apiBase()).toBe(DEFAULT_DEPLOYLINT_API);
	});
});
