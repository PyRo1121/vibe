import { importScryfallSet } from '$lib/server/sync/scryfall';

/** Refresh prices for the three most recently released MTG sets. */
export async function runScheduledSync(env: Env): Promise<void> {
	if (!env.DB) return;

	const { results } = await env.DB.prepare(
		`SELECT code FROM sets WHERE game_slug = 'mtg' AND code IS NOT NULL ORDER BY released_at DESC LIMIT 3`
	).all<{ code: string }>();

	for (const row of results ?? []) {
		if (!row.code) continue;
		try {
			await importScryfallSet(env.DB, row.code);
		} catch (err) {
			console.error(`Scryfall sync failed for ${row.code}:`, err);
		}
	}
}
