import type { PageServerLoad } from './$types';
import { GAMES } from '$lib/games';
import { countCatalog } from '$lib/server/db';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env?.DB;
	const catalog = db ? await countCatalog(db) : { sets: 0, cards: 0 };
	return { games: GAMES, catalog };
};
