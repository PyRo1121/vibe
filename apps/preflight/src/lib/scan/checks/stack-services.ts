import type { CheckCtx } from '$lib/scan/checks/helpers';
import type { CrawledPage } from '$lib/scan/crawl';
import { mentionsStack, type PageMeta } from '$lib/scan/parse';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';
import type { ScanCheck } from '$lib/scan/types';

type StackSignals = ReturnType<typeof mentionsStack>;

const AUTH_PROVIDERS: Array<[keyof StackSignals, string]> = [
	['clerk', 'Clerk'],
	['auth0', 'Auth0'],
	['workos', 'WorkOS']
];

const ERROR_MONITORING: Array<[keyof StackSignals, string]> = [
	['sentry', 'Sentry'],
	['logRocket', 'LogRocket']
];

const AI_PROVIDERS: Array<[keyof StackSignals, string]> = [
	['openai', 'OpenAI'],
	['anthropic', 'Anthropic'],
	['replicate', 'Replicate'],
	['huggingFace', 'Hugging Face']
];

export function pushStackChecks(
	checks: ScanCheck[],
	meta: PageMeta,
	html: string,
	ctx: CheckCtx,
	crawledPages: CrawledPage[]
): void {
	// Stripe/Supabase/Firebase often load only on pricing or app pages.
	const stack = { ...meta.stack };
	let stackHtml = html;
	for (const page of crawledPages) {
		if (!page.html) continue;
		const pageStack = mentionsStack(page.html);
		mergeStackSignals(stack, pageStack);
		stackHtml += page.html;
	}

	if (stack.stripe) {
		checks.push(
			makeCheck(
				'stripe',
				'payments',
				'Stripe integration',
				/pk_(live|test)_/.test(stackHtml) ? 'pass' : 'warn',
				'Stripe.js detected — verify Checkout/webhook setup in dashboard',
				fixPrompt('stripe', ctx)
			)
		);
	}

	if (stack.paddle) {
		checks.push(
			makeCheck(
				'paddle',
				'payments',
				'Paddle integration',
				'pass',
				'Paddle checkout detected — verify products, tax settings, and signed webhooks before charging',
				fixPrompt('paddle', ctx)
			)
		);
	}

	if (stack.lemonSqueezy) {
		checks.push(
			makeCheck(
				'lemon-squeezy',
				'payments',
				'Lemon Squeezy integration',
				'pass',
				'Lemon Squeezy checkout detected — verify variants, license keys, and webhook handling before launch',
				fixPrompt('lemon-squeezy', ctx)
			)
		);
	}

	if (stack.supabase) {
		checks.push(
			makeCheck(
				'supabase',
				'security',
				'Supabase client in page',
				'warn',
				'Supabase URL detected — confirm RLS policies on every table',
				fixPrompt('supabase', ctx)
			)
		);
	}

	if (stack.firebase) {
		checks.push(
			makeCheck(
				'firebase',
				'security',
				'Firebase in page',
				'warn',
				'Firebase detected — review Firestore/Storage security rules',
				fixPrompt('firebase', ctx)
			)
		);
	}

	const authProviders = labelsFor(stack, AUTH_PROVIDERS);
	if (authProviders.length > 0) {
		checks.push(
			makeCheck(
				'auth-provider',
				'security',
				'Auth provider detected',
				'warn',
				`${authProviders.join(', ')} detected — verify allowed redirect URLs, session lifetime, and production keys`,
				fixPrompt('auth-provider', { ...ctx, message: authProviders.join(', ') })
			)
		);
	}

	const monitoring = labelsFor(stack, ERROR_MONITORING);
	if (monitoring.length > 0) {
		checks.push(
			makeCheck(
				'error-monitoring',
				'launch',
				'Error monitoring',
				'pass',
				`${monitoring.join(', ')} detected — production errors should be visible after launch`,
				fixPrompt('error-monitoring', { ...ctx, message: monitoring.join(', ') })
			)
		);
	}

	const aiProviders = labelsFor(stack, AI_PROVIDERS);
	if (aiProviders.length > 0) {
		checks.push(
			makeCheck(
				'ai-client-api',
				'security',
				'Client-side AI API reference',
				'warn',
				`${aiProviders.join(', ')} API references detected in client HTML — verify calls are proxied server-side and keys are never shipped`,
				fixPrompt('ai-client-api', { ...ctx, message: aiProviders.join(', ') })
			)
		);
	}
}

function mergeStackSignals(target: StackSignals, source: StackSignals): void {
	for (const key of Object.keys(source) as Array<keyof StackSignals>) {
		target[key] ||= source[key];
	}
}

function labelsFor(stack: StackSignals, providers: Array<[keyof StackSignals, string]>): string[] {
	return providers.filter(([key]) => stack[key]).map(([, label]) => label);
}
