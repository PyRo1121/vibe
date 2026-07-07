/// <reference types="@cloudflare/workers-types" />
// Keep bindings aligned with wrangler.jsonc vars and secrets.

interface Env {
	ASSETS: Fetcher;
	/** Service binding — same-zone fetches bypass Cloudflare 522 loop. */
	SELF?: Fetcher;
	/** Stored scan reports for shareable permalinks. */
	REPORTS?: KVNamespace;
	/** Better Auth users, sessions, workspaces, projects, and subscriptions. */
	AUTH_DB?: D1Database;
	/** Atomic counters for production rate limits and daily budgets. */
	LIMITER?: DurableObjectNamespace;
	/** Workers AI — used for the paid copy-review extra. */
	AI?: { run(model: string, options: Record<string, unknown>): Promise<unknown> };
	PUBLIC_SITE_NAME: string;
	PUBLIC_APP_URL?: string;
	PUBLIC_PLAUSIBLE_DOMAIN?: string;
	PUBLIC_PLAUSIBLE_SCRIPT?: string;
	DEPLOYLINT_ALPHA_FREE_UNLOCK?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_WEBHOOK_SECRET?: string;
	STRIPE_PRICE_SOLO?: string;
	STRIPE_PRICE_BUILDER?: string;
	STRIPE_PRICE_AGENCY?: string;
	BETTER_AUTH_URL?: string;
	BETTER_AUTH_SECRET?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
	AUTH_EMAIL_REPLY_TO?: string;
	/** Optional — raises GitHub API rate limits for repo scans. */
	GITHUB_TOKEN?: string;
}

declare namespace Cloudflare {
	interface Env {
		ASSETS: Fetcher;
		SELF?: Fetcher;
		REPORTS?: KVNamespace;
		AUTH_DB?: D1Database;
		LIMITER?: DurableObjectNamespace;
		AI?: { run(model: string, options: Record<string, unknown>): Promise<unknown> };
		PUBLIC_SITE_NAME: string;
		PUBLIC_APP_URL?: string;
		PUBLIC_PLAUSIBLE_DOMAIN?: string;
		PUBLIC_PLAUSIBLE_SCRIPT?: string;
		DEPLOYLINT_ALPHA_FREE_UNLOCK?: string;
		STRIPE_SECRET_KEY?: string;
		STRIPE_WEBHOOK_SECRET?: string;
		STRIPE_PRICE_SOLO?: string;
		STRIPE_PRICE_BUILDER?: string;
		STRIPE_PRICE_AGENCY?: string;
		BETTER_AUTH_URL?: string;
		BETTER_AUTH_SECRET?: string;
		GITHUB_CLIENT_ID?: string;
		GITHUB_CLIENT_SECRET?: string;
		RESEND_API_KEY?: string;
		RESEND_FROM_EMAIL?: string;
		AUTH_EMAIL_REPLY_TO?: string;
		GITHUB_TOKEN?: string;
	}
}
