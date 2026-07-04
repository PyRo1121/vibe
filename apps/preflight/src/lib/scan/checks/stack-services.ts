import type { ScanCheck } from '$lib/scan/types';
import type { CrawledPage } from '$lib/scan/crawl';
import type { CheckCtx } from '$lib/scan/checks/helpers';
import { mentionsStack, type PageMeta } from '$lib/scan/parse';
import { fixPrompt } from '$lib/scan/prompts';
import { makeCheck } from '$lib/scan/score';

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
		stack.stripe ||= pageStack.stripe;
		stack.supabase ||= pageStack.supabase;
		stack.firebase ||= pageStack.firebase;
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
}
