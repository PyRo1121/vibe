import { error } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types';

export function requireDb(platform: App.Platform | undefined): D1Database {
	const db = platform?.env?.DB;
	if (!db) error(503, 'Database not bound');
	return db;
}
