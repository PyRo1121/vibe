import { describe, expect, it } from 'vitest';

import { buildAuthEmailMessage, resolveAuthEmailConfig } from './auth-email';

describe('auth email', () => {
	it('requires both a Resend API key and a verified from address', () => {
		expect(resolveAuthEmailConfig({})).toBeNull();
		expect(resolveAuthEmailConfig({ RESEND_API_KEY: 're_test' })).toBeNull();
		expect(
			resolveAuthEmailConfig({
				RESEND_API_KEY: 're_test',
				RESEND_FROM_EMAIL: 'Deploylint <login@deploylint.com>'
			})
		).toEqual({
			apiKey: 're_test',
			from: 'Deploylint <login@deploylint.com>',
			replyTo: null
		});
	});

	it('builds verification email content without leaking raw html from the user name', () => {
		const message = buildAuthEmailMessage({
			kind: 'verify',
			to: 'founder@example.com',
			userName: '<script>alert(1)</script>',
			url: 'https://deploylint.com/api/auth/verify-email?token=abc'
		});

		expect(message.subject).toBe('Verify your Deploylint email');
		expect(message.text).toContain('https://deploylint.com/api/auth/verify-email?token=abc');
		expect(message.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(message.html).not.toContain('<script>alert(1)</script>');
	});

	it('builds password reset email content', () => {
		const message = buildAuthEmailMessage({
			kind: 'reset-password',
			to: 'founder@example.com',
			userName: 'Olen',
			url: 'https://deploylint.com/api/auth/reset-password?token=abc'
		});

		expect(message.subject).toBe('Reset your Deploylint password');
		expect(message.text).toContain('Reset your password');
		expect(message.html).toContain('Reset your password');
	});
});
