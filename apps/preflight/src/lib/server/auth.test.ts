import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	betterAuth: vi.fn<(options: unknown) => unknown>((options) => ({
		handler: vi.fn<() => Response>(() => new Response()),
		options,
		api: { getSession: vi.fn<() => Promise<null>>(async () => null) }
	})),
	sendAuthEmail: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {})
}));

vi.mock('better-auth', () => ({
	betterAuth: mocks.betterAuth
}));

vi.mock('./auth-email', () => ({
	sendAuthEmail: mocks.sendAuthEmail
}));

import { authSchemaFieldMappings, getDeploylintAuth } from './auth';
import { AUTH_ROUTE_PREFIX } from './auth-config';

describe('authSchemaFieldMappings', () => {
	it('maps Better Auth camelCase fields to D1 snake_case columns', () => {
		expect(authSchemaFieldMappings()).toMatchObject({
			user: {
				fields: {
					emailVerified: 'email_verified',
					createdAt: 'created_at',
					updatedAt: 'updated_at'
				}
			},
			session: {
				fields: {
					expiresAt: 'expires_at',
					ipAddress: 'ip_address',
					userAgent: 'user_agent',
					userId: 'user_id'
				}
			},
			account: {
				fields: {
					providerId: 'provider_id',
					accessToken: 'access_token',
					refreshTokenExpiresAt: 'refresh_token_expires_at'
				}
			},
			verification: {
				fields: {
					expiresAt: 'expires_at'
				}
			}
		});
	});
});

describe('getDeploylintAuth', () => {
	beforeEach(() => {
		mocks.betterAuth.mockClear();
		mocks.sendAuthEmail.mockClear();
	});

	it('returns null when auth storage is unavailable', () => {
		expect(getDeploylintAuth({}, 'https://deploylint.com')).toBeNull();
		expect(mocks.betterAuth).not.toHaveBeenCalled();
	});

	it('returns null for production URLs without an auth secret', () => {
		const env = {
			AUTH_DB: {} as D1Database,
			PUBLIC_APP_URL: 'https://deploylint.com'
		};

		expect(getDeploylintAuth(env, 'https://deploylint.com')).toBeNull();
		expect(mocks.betterAuth).not.toHaveBeenCalled();
	});

	it('configures local email/password auth, email delivery, and GitHub provider', async () => {
		const env = {
			AUTH_DB: {} as D1Database,
			PUBLIC_APP_URL: 'http://localhost:5173',
			RESEND_API_KEY: 'resend-key',
			RESEND_FROM_EMAIL: 'Deploylint <hello@example.test>',
			GITHUB_CLIENT_ID: 'github-client',
			GITHUB_CLIENT_SECRET: 'github-secret'
		};

		const auth = getDeploylintAuth(env, 'http://127.0.0.1:5173');

		expect(auth).not.toBeNull();
		expect(mocks.betterAuth).toHaveBeenCalledOnce();
		expect(auth?.options).toMatchObject({
			appName: 'Deploylint',
			baseURL: 'http://localhost:5173',
			basePath: AUTH_ROUTE_PREFIX,
			database: env.AUTH_DB,
			secret: 'dev-only-localhost:5173',
			trustedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
			emailAndPassword: {
				enabled: true,
				disableSignUp: false,
				requireEmailVerification: true,
				minPasswordLength: 10
			},
			emailVerification: {
				sendOnSignUp: true
			},
			socialProviders: {
				github: {
					clientId: 'github-client',
					clientSecret: 'github-secret'
				}
			}
		});

		const authUser = {
			id: 'user_1',
			email: 'user@example.test',
			emailVerified: false,
			name: 'User',
			createdAt: new Date('2026-01-01T00:00:00.000Z'),
			updatedAt: new Date('2026-01-01T00:00:00.000Z')
		};

		await auth?.options.emailAndPassword?.sendResetPassword?.({
			user: authUser,
			url: 'https://deploylint.com/reset',
			token: 'reset-token'
		});
		await auth?.options.emailVerification?.sendVerificationEmail?.({
			user: authUser,
			url: 'https://deploylint.com/verify',
			token: 'verify-token'
		});

		expect(mocks.sendAuthEmail).toHaveBeenCalledWith(env, {
			kind: 'reset-password',
			to: 'user@example.test',
			userName: 'User',
			url: 'https://deploylint.com/reset'
		});
		expect(mocks.sendAuthEmail).toHaveBeenCalledWith(env, {
			kind: 'verify',
			to: 'user@example.test',
			userName: 'User',
			url: 'https://deploylint.com/verify'
		});
	});

	it('keeps email sign in enabled but disables server-side signup without email delivery', () => {
		const env = {
			AUTH_DB: {} as D1Database,
			PUBLIC_APP_URL: 'http://localhost:5173'
		};

		const auth = getDeploylintAuth(env, 'http://127.0.0.1:5173');

		expect(auth).not.toBeNull();
		expect(auth?.options).toMatchObject({
			emailAndPassword: {
				enabled: true,
				disableSignUp: true,
				requireEmailVerification: true
			},
			emailVerification: {
				sendOnSignUp: false
			}
		});
	});

	it('caches auth instances per D1 binding', () => {
		const env = {
			AUTH_DB: {} as D1Database,
			BETTER_AUTH_URL: 'https://deploylint.com',
			BETTER_AUTH_SECRET: 'secret'
		};

		const first = getDeploylintAuth(env, 'https://deploylint.com');
		const second = getDeploylintAuth(env, 'https://deploylint.com');

		expect(first).toBe(second);
		expect(mocks.betterAuth).toHaveBeenCalledOnce();
	});
});
