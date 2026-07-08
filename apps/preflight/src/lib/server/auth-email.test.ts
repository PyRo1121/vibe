import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const send = vi.fn<() => Promise<{ error: { message: string } | null }>>(async () => ({
		error: null
	}));
	const Resend = vi.fn<(this: { emails: { send: typeof send } }) => void>(function Resend() {
		this.emails = { send };
	});

	return { Resend, send };
});

vi.mock('resend', () => ({
	Resend: mocks.Resend
}));

import { buildAuthEmailMessage, resolveAuthEmailConfig, sendAuthEmail } from './auth-email';

describe('auth email', () => {
	beforeEach(() => {
		mocks.Resend.mockClear();
		mocks.send.mockClear();
		mocks.send.mockResolvedValue({ error: null });
	});

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

	it('trims configured sender fields and optional reply-to address', () => {
		expect(
			resolveAuthEmailConfig({
				RESEND_API_KEY: '  resend-key  ',
				RESEND_FROM_EMAIL: '  Deploylint <login@deploylint.com>  ',
				AUTH_EMAIL_REPLY_TO: '  support@deploylint.com  '
			})
		).toEqual({
			apiKey: 'resend-key',
			from: 'Deploylint <login@deploylint.com>',
			replyTo: 'support@deploylint.com'
		});
		expect(
			resolveAuthEmailConfig({
				RESEND_API_KEY: 'resend-key',
				RESEND_FROM_EMAIL: 'Deploylint <login@deploylint.com>',
				AUTH_EMAIL_REPLY_TO: '   '
			})?.replyTo
		).toBeNull();
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

	it('escapes action URLs and defaults blank names to a generic greeting', () => {
		const message = buildAuthEmailMessage({
			kind: 'verify',
			to: 'founder@example.com',
			userName: '   ',
			url: 'https://deploylint.com/api/auth/verify-email?token=<abc>&next=/app'
		});

		expect(message.text).toContain('Hi there,');
		expect(message.html).toContain('Hi there,');
		expect(message.html).toContain('token=&lt;abc&gt;&amp;next=/app');
		expect(message.html).not.toContain('token=<abc>&next=/app');
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

	it('sends auth email through Resend with optional reply-to', async () => {
		const env = {
			RESEND_API_KEY: 'resend-key',
			RESEND_FROM_EMAIL: 'Deploylint <login@deploylint.com>',
			AUTH_EMAIL_REPLY_TO: 'support@deploylint.com'
		};

		await sendAuthEmail(env, {
			kind: 'verify',
			to: 'founder@example.com',
			userName: 'Olen',
			url: 'https://deploylint.com/api/auth/verify-email?token=abc'
		});

		expect(mocks.Resend).toHaveBeenCalledWith('resend-key');
		expect(mocks.send).toHaveBeenCalledWith(
			expect.objectContaining({
				from: 'Deploylint <login@deploylint.com>',
				to: ['founder@example.com'],
				replyTo: 'support@deploylint.com',
				subject: 'Verify your Deploylint email'
			})
		);
	});

	it('fails clearly when Resend rejects the email', async () => {
		mocks.send.mockResolvedValueOnce({ error: { message: 'domain not verified' } });

		await expect(
			sendAuthEmail(
				{
					RESEND_API_KEY: 'resend-key',
					RESEND_FROM_EMAIL: 'Deploylint <login@deploylint.com>'
				},
				{
					kind: 'reset-password',
					to: 'founder@example.com',
					url: 'https://deploylint.com/api/auth/reset-password?token=abc'
				}
			)
		).rejects.toThrow('Resend auth email failed: domain not verified');
	});
});
