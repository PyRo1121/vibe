import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	createAuthClient: vi.fn<(options: unknown) => { options: unknown }>((options) => ({ options }))
}));

vi.mock('better-auth/svelte', () => ({
	createAuthClient: mocks.createAuthClient
}));

import { authClient } from './auth-client';

describe('authClient', () => {
	it('uses the app auth route prefix', () => {
		expect(mocks.createAuthClient).toHaveBeenCalledOnce();
		expect(mocks.createAuthClient).toHaveBeenCalledWith({
			basePath: '/api/auth'
		});
		expect(authClient).toEqual({
			options: {
				basePath: '/api/auth'
			}
		});
	});
});
