import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';

import {
	AUTH_ROUTE_PREFIX,
	resolveAuthBaseUrl,
	resolveAuthFeatureFlags,
	resolveAuthSecret
} from './auth-config';
import { sendAuthEmail } from './auth-email';

export function authSchemaFieldMappings(): Pick<
	BetterAuthOptions,
	'user' | 'session' | 'account' | 'verification'
> {
	return {
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
				createdAt: 'created_at',
				updatedAt: 'updated_at',
				ipAddress: 'ip_address',
				userAgent: 'user_agent',
				userId: 'user_id'
			}
		},
		account: {
			fields: {
				accountId: 'account_id',
				providerId: 'provider_id',
				userId: 'user_id',
				accessToken: 'access_token',
				refreshToken: 'refresh_token',
				idToken: 'id_token',
				accessTokenExpiresAt: 'access_token_expires_at',
				refreshTokenExpiresAt: 'refresh_token_expires_at',
				createdAt: 'created_at',
				updatedAt: 'updated_at'
			}
		},
		verification: {
			fields: {
				expiresAt: 'expires_at',
				createdAt: 'created_at',
				updatedAt: 'updated_at'
			}
		}
	};
}

function createDeploylintAuth(
	env: Partial<Env>,
	baseURL: string,
	requestOrigin: string,
	secret: string,
	features: ReturnType<typeof resolveAuthFeatureFlags>
) {
	return betterAuth({
		appName: 'Deploylint',
		baseURL,
		basePath: AUTH_ROUTE_PREFIX,
		database: env.AUTH_DB,
		secret,
		trustedOrigins: [baseURL, requestOrigin],
		...authSchemaFieldMappings(),
		emailAndPassword: {
			enabled: true,
			disableSignUp: !features.emailSignup,
			requireEmailVerification: true,
			minPasswordLength: 10,
			sendResetPassword: async ({ user, url }) => {
				await sendAuthEmail(env, {
					kind: 'reset-password',
					to: user.email,
					userName: user.name,
					url
				});
			}
		},
		emailVerification: {
			sendOnSignUp: features.emailDelivery,
			sendVerificationEmail: async ({ user, url }) => {
				await sendAuthEmail(env, {
					kind: 'verify',
					to: user.email,
					userName: user.name,
					url
				});
			}
		},
		socialProviders: configuredGitHubProvider(env)
	});
}

type DeploylintAuth = ReturnType<typeof createDeploylintAuth>;

const authCache = new WeakMap<D1Database, DeploylintAuth>();

function configuredGitHubProvider(env: Partial<Env> | undefined) {
	const clientId = env?.GITHUB_CLIENT_ID?.trim();
	const clientSecret = env?.GITHUB_CLIENT_SECRET?.trim();
	if (!clientId || !clientSecret) return {};

	return {
		github: {
			clientId,
			clientSecret
		}
	};
}

export function getDeploylintAuth(
	env: Partial<Env> | undefined,
	requestOrigin: string
): DeploylintAuth | null {
	if (!env?.AUTH_DB) return null;

	const cached = authCache.get(env.AUTH_DB);
	if (cached) return cached;

	const baseURL = resolveAuthBaseUrl(env, requestOrigin).replace(/\/$/, '');
	const secret = resolveAuthSecret(env, baseURL);
	if (!secret) return null;

	const features = resolveAuthFeatureFlags(env);
	const auth = createDeploylintAuth(env, baseURL, requestOrigin, secret, features);

	authCache.set(env.AUTH_DB, auth);
	return auth;
}
