/// <reference types="@cloudflare/workers-types" />

/** Cloudflare bindings — keep in sync with wrangler.jsonc (run `npm run cf-typegen` to diff). */
interface Env {
	DB: D1Database;
	CARD_IMAGES: R2Bucket;
	ASSETS: Fetcher;
	PUBLIC_SITE_NAME: string;
	PUBLIC_SITE_URL: string;
	/** Optional: `wrangler secret put SYNC_SECRET` */
	SYNC_SECRET?: string;
}

declare namespace Cloudflare {
	interface Env {
		DB: D1Database;
		CARD_IMAGES: R2Bucket;
		ASSETS: Fetcher;
		PUBLIC_SITE_NAME: string;
		PUBLIC_SITE_URL: string;
		SYNC_SECRET?: string;
	}
}
