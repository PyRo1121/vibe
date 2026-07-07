export type AuthEmailKind = 'verify' | 'reset-password';

export interface AuthEmailInput {
	kind: AuthEmailKind;
	to: string;
	userName?: string | null;
	url: string;
}

export interface AuthEmailMessage {
	from?: string;
	to: string;
	replyTo?: string;
	subject: string;
	text: string;
	html: string;
}

export interface AuthEmailConfig {
	apiKey: string;
	from: string;
	replyTo: string | null;
}

function clean(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function resolveAuthEmailConfig(env: Partial<Env> | undefined): AuthEmailConfig | null {
	const apiKey = clean(env?.RESEND_API_KEY);
	const from = clean(env?.RESEND_FROM_EMAIL);
	if (!apiKey || !from) return null;

	return {
		apiKey,
		from,
		replyTo: clean(env?.AUTH_EMAIL_REPLY_TO)
	};
}

export function buildAuthEmailMessage(input: AuthEmailInput): AuthEmailMessage {
	const safeName = escapeHtml(input.userName?.trim() || 'there');
	const safeUrl = escapeHtml(input.url);
	const verify = input.kind === 'verify';
	const subject = verify ? 'Verify your Deploylint email' : 'Reset your Deploylint password';
	const heading = verify ? 'Verify your email' : 'Reset your password';
	const body = verify
		? 'Confirm this email address to finish setting up your Deploylint workspace.'
		: 'Use this secure link to choose a new Deploylint password.';

	return {
		to: input.to,
		subject,
		text: `${heading}\n\nHi ${input.userName?.trim() || 'there'},\n\n${body}\n\n${input.url}\n\nIf you did not request this, you can ignore this email.`,
		html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#18181b">
<h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
<p>Hi ${safeName},</p>
<p>${body}</p>
<p><a href="${safeUrl}" style="color:#0369a1">Continue to Deploylint</a></p>
<p style="font-size:13px;color:#71717a">If you did not request this, you can ignore this email.</p>
</div>`
	};
}

export async function sendAuthEmail(
	env: Partial<Env> | undefined,
	input: AuthEmailInput
): Promise<void> {
	const config = resolveAuthEmailConfig(env);
	if (!config) throw new Error('Resend auth email is not configured');

	const { Resend } = await import('resend');
	const resend = new Resend(config.apiKey);
	const message = buildAuthEmailMessage(input);
	const { error } = await resend.emails.send({
		from: config.from,
		to: [message.to],
		replyTo: config.replyTo ?? undefined,
		subject: message.subject,
		text: message.text,
		html: message.html
	});

	if (error) {
		throw new Error(`Resend auth email failed: ${error.message}`);
	}
}
