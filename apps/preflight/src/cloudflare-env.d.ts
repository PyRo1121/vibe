/// <reference types="@cloudflare/workers-types" />
// Keep bindings aligned with wrangler.jsonc vars and secrets.

interface Env {
	ASSETS: Fetcher;
	/** Service binding — same-zone fetches bypass Cloudflare 522 loop. */
	SELF?: Fetcher;
	/** Stored scan reports for shareable permalinks. */
	REPORTS?: KVNamespace;
	/** Atomic counters for production rate limits and daily budgets. */
	LIMITER?: DurableObjectNamespace;
	/** Workers AI — used for the paid copy-review extra. */
	AI?: { run(model: string, options: Record<string, unknown>): Promise<unknown> };
	PUBLIC_SITE_NAME: string;
	PUBLIC_APP_URL?: string;
	PUBLIC_PLAUSIBLE_DOMAIN?: string;
	PUBLIC_PLAUSIBLE_SCRIPT?: string;
	STRIPE_SECRET_KEY?: string;
	STRIPE_WEBHOOK_SECRET?: string;
	/** Optional — raises GitHub API rate limits for repo scans. */
	GITHUB_TOKEN?: string;
}

declare namespace Cloudflare {
	interface Env {
		ASSETS: Fetcher;
		SELF?: Fetcher;
		REPORTS?: KVNamespace;
		LIMITER?: DurableObjectNamespace;
		AI?: { run(model: string, options: Record<string, unknown>): Promise<unknown> };
		PUBLIC_SITE_NAME: string;
		PUBLIC_APP_URL?: string;
		PUBLIC_PLAUSIBLE_DOMAIN?: string;
		PUBLIC_PLAUSIBLE_SCRIPT?: string;
		STRIPE_SECRET_KEY?: string;
		STRIPE_WEBHOOK_SECRET?: string;
		GITHUB_TOKEN?: string;
	}
}
