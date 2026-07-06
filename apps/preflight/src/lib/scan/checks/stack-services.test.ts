import type { CrawledPage } from '$lib/scan/crawl';
import { parsePageMeta } from '$lib/scan/parse';
import type { ScanCheck } from '$lib/scan/types';
import { describe, expect, it } from 'vitest';

import { pushStackChecks } from './stack-services';

const ctx = { url: 'https://app.example.com' };
const finalUrl = new URL(ctx.url);

function checksFor(homeHtml: string, crawledPages: CrawledPage[] = []): ScanCheck[] {
	const checks: ScanCheck[] = [];
	pushStackChecks(checks, parsePageMeta(homeHtml, finalUrl), homeHtml, ctx, crawledPages);
	return checks;
}

describe('pushStackChecks', () => {
	it('warns for payment providers detected only from visible page signatures', () => {
		const checks = checksFor('<html><body>Home</body></html>', [
			{
				url: 'https://app.example.com/pricing',
				role: 'pricing',
				status: 200,
				html: '<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script><script src="https://assets.lemonsqueezy.com/lemon.js"></script>',
				wordCount: 3
			}
		]);

		expect(checks.find((check) => check.id === 'paddle')?.status).toBe('warn');
		expect(checks.find((check) => check.id === 'lemon-squeezy')?.status).toBe('warn');
	});

	it('warns when Stripe is only visible from client-side page evidence', () => {
		const checks = checksFor('<script src="https://js.stripe.com/v3"></script>');

		const stripe = checks.find((check) => check.id === 'stripe');

		expect(stripe?.status).toBe('warn');
		expect(stripe?.message).toContain('Repo scan');
	});

	it('warns when database providers are visible but security rules are not verified', () => {
		const checks = checksFor(
			'<script>const supabaseUrl = "https://abc.supabase.co"; const firebaseConfig = { projectId: "demo" };</script>'
		);

		const supabase = checks.find((check) => check.id === 'supabase');
		const firebase = checks.find((check) => check.id === 'firebase');

		expect(supabase?.status).toBe('warn');
		expect(supabase?.message).toContain('RLS');
		expect(firebase?.status).toBe('warn');
		expect(firebase?.message).toContain('security rules');
	});

	it('warns when auth providers are detected so redirect/session settings are reviewed', () => {
		const checks = checksFor(
			'<script src="https://js.clerk.com/v4/clerk.browser.js"></script><script src="https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js"></script>'
		);

		const auth = checks.find((check) => check.id === 'auth-provider');

		expect(auth?.status).toBe('warn');
		expect(auth?.message).toContain('Clerk');
		expect(auth?.message).toContain('Auth0');
	});

	it('warns when error monitoring is detected but alert delivery is unverified', () => {
		const checks = checksFor(
			'<script src="https://browser.sentry-cdn.com/8.0.0/bundle.min.js"></script><script>LogRocket.init("app/id")</script>'
		);

		const monitoring = checks.find((check) => check.id === 'error-monitoring');

		expect(monitoring?.status).toBe('warn');
		expect(monitoring?.message).toContain('Sentry');
		expect(monitoring?.message).toContain('LogRocket');
		expect(monitoring?.message).toContain('test exception');
	});

	it('warns when AI provider API references appear client-side', () => {
		const checks = checksFor(
			'<script>fetch("https://api.openai.com/v1/chat/completions"); fetch("https://api.anthropic.com/v1/messages");</script>'
		);

		const aiClient = checks.find((check) => check.id === 'ai-client-api');

		expect(aiClient?.status).toBe('warn');
		expect(aiClient?.message).toContain('OpenAI');
		expect(aiClient?.message).toContain('Anthropic');
	});
});
