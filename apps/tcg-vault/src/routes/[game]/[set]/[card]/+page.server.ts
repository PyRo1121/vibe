import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getGame } from '$lib/games';
import { getCard } from '$lib/server/db';
import { requireDb } from '$lib/server/require-db';

export const load: PageServerLoad = async ({ params, platform }) => {
	const game = getGame(params.game);
	if (!game) error(404, 'Game not found');

	const db = requireDb(platform);

	const card = await getCard(db, params.game, params.set, params.card);
	if (!card) error(404, 'Card not found');

	return { game, card };
};
