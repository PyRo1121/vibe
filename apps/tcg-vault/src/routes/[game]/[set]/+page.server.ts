import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGame } from '$lib/games';
import { getSet, listCardsInSet } from '$lib/server/db';
import { requireDb } from '$lib/server/require-db';

export const load: PageServerLoad = async ({ params, platform }) => {
	const game = getGame(params.game);
	if (!game) error(404, 'Game not found');

	const db = requireDb(platform);

	const set = await getSet(db, params.game, params.set);
	if (!set) error(404, 'Set not found');

	const cards = await listCardsInSet(db, set.id);
	const totalValue = cards.reduce((sum, c) => sum + (c.market_usd ?? 0), 0);

	return { game, set, cards, totalValue };
};
