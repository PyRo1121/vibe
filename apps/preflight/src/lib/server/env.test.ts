import { describe, expect, it } from 'vitest';
import { resolveAppUrl } from './env';

describe('resolveAppUrl', () => {
	it('prefers configured PUBLIC_APP_URL over request origin', () => {
		expect(
			resolveAppUrl({ PUBLIC_APP_URL: 'https://preflight.latham.cloud/' } as Env, 'http://evil.test')
		).toBe('https://preflight.latham.cloud');
	});
});
