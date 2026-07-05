import { getGame } from '$lib/games';
import { listSets } from '$lib/server/db';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
	const game = getGame(params.game);
	if (!game) error(404, 'Game not found');

	const db = platform?.env?.DB;
	const sets = db ? await listSets(db, params.game) : [];

	return { game, sets };
};
