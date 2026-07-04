import { dev } from '$app/environment';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireSyncAuth } from '$lib/server/sync-auth';
import { requireDb } from '$lib/server/require-db';
import { importScryfallSet, listScryfallMtgSets } from '$lib/server/sync/scryfall';

/** POST /api/sync/scryfall?set=CODE — import one MTG set from Scryfall */
export const POST: RequestHandler = async ({ platform, url, request }) => {
	const db = requireDb(platform);
	requireSyncAuth(request, platform?.env?.SYNC_SECRET, !dev);

	const setCode = url.searchParams.get('set');
	if (!setCode) error(400, 'Missing ?set=CODE query param');

	try {
		const result = await importScryfallSet(db, setCode);
		return json({ ok: true, ...result });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Sync failed';
		error(502, message);
	}
};

/** GET /api/sync/scryfall — list importable MTG set codes */
export const GET: RequestHandler = async ({ platform, request }) => {
	requireSyncAuth(request, platform?.env?.SYNC_SECRET, !dev);

	try {
		const sets = await listScryfallMtgSets();
		return json({
			count: sets.length,
			sets: sets.map((set) => ({
				code: set.code,
				name: set.name,
				card_count: set.card_count,
				released_at: set.released_at,
				set_type: set.set_type
			}))
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to list sets';
		error(502, message);
	}
};
