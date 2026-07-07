import { describe, expect, it } from 'vitest';

import { authSchemaFieldMappings } from './auth';

describe('deploylint auth', () => {
	it('maps Better Auth logical fields to the snake_case D1 migration columns', () => {
		const schema = authSchemaFieldMappings();

		expect(schema.user?.fields).toMatchObject({
			emailVerified: 'email_verified',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		});
		expect(schema.session?.fields).toMatchObject({
			expiresAt: 'expires_at',
			ipAddress: 'ip_address',
			userAgent: 'user_agent',
			userId: 'user_id'
		});
		expect(schema.account?.fields).toMatchObject({
			accountId: 'account_id',
			providerId: 'provider_id',
			accessToken: 'access_token',
			refreshToken: 'refresh_token',
			accessTokenExpiresAt: 'access_token_expires_at',
			refreshTokenExpiresAt: 'refresh_token_expires_at'
		});
		expect(schema.verification?.fields).toMatchObject({
			expiresAt: 'expires_at',
			createdAt: 'created_at',
			updatedAt: 'updated_at'
		});
	});
});
