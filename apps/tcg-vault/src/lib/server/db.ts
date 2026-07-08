export type Db = D1Database;

export interface SetRow {
	id: string;
	game_slug: string;
	slug: string;
	name: string;
	code: string | null;
	released_at: string | null;
	card_count: number;
}

export interface CardRow {
	id: string;
	game_slug: string;
	set_id: string;
	slug: string;
	name: string;
	collector_number: string | null;
	rarity: string | null;
	image_source_url: string | null;
	image_r2_key: string | null;
	external_id: string | null;
	set_slug?: string;
	set_name?: string;
}

export interface CardWithPrice extends CardRow {
	market_usd: number | null;
	market_usd_foil: number | null;
	market_eur: number | null;
	ebay_usd: number | null;
	price_source: string | null;
	price_updated_at: string | null;
}

export async function listSets(db: Db, gameSlug: string): Promise<SetRow[]> {
	const { results } = await db
		.prepare(
			`SELECT id, game_slug, slug, name, code, released_at, card_count
       FROM sets WHERE game_slug = ? ORDER BY released_at DESC, name ASC`
		)
		.bind(gameSlug)
		.all<SetRow>();
	return results ?? [];
}

export async function getSet(db: Db, gameSlug: string, setSlug: string): Promise<SetRow | null> {
	return (
		(await db
			.prepare(
				`SELECT id, game_slug, slug, name, code, released_at, card_count
         FROM sets WHERE game_slug = ? AND slug = ?`
			)
			.bind(gameSlug, setSlug)
			.first<SetRow>()) ?? null
	);
}

export async function listCardsInSet(db: Db, setId: string): Promise<CardWithPrice[]> {
	const { results } = await db
		.prepare(
			`SELECT c.id, c.game_slug, c.set_id, c.slug, c.name, c.collector_number, c.rarity,
              c.image_source_url, c.image_r2_key, c.external_id,
              p.market_usd, p.market_usd_foil, p.market_eur, p.ebay_usd,
              p.price_source, p.updated_at AS price_updated_at
       FROM cards c
       LEFT JOIN prices p ON p.card_id = c.id
       WHERE c.set_id = ?
       ORDER BY c.collector_number ASC, c.name ASC`
		)
		.bind(setId)
		.all<CardWithPrice>();
	return results ?? [];
}

export async function getCard(
	db: Db,
	gameSlug: string,
	setSlug: string,
	cardSlug: string
): Promise<CardWithPrice | null> {
	return (
		(await db
			.prepare(
				`SELECT c.id, c.game_slug, c.set_id, c.slug, c.name, c.collector_number, c.rarity,
              c.image_source_url, c.image_r2_key, c.external_id,
              s.slug AS set_slug, s.name AS set_name,
              p.market_usd, p.market_usd_foil, p.market_eur, p.ebay_usd,
              p.price_source, p.updated_at AS price_updated_at
       FROM cards c
       JOIN sets s ON s.id = c.set_id
       LEFT JOIN prices p ON p.card_id = c.id
       WHERE c.game_slug = ? AND s.slug = ? AND c.slug = ?`
			)
			.bind(gameSlug, setSlug, cardSlug)
			.first<CardWithPrice>()) ?? null
	);
}

export async function countCatalog(db: Db): Promise<{ sets: number; cards: number }> {
	const sets = (await db.prepare(`SELECT COUNT(*) AS n FROM sets`).first<{ n: number }>())?.n ?? 0;
	const cards =
		(await db.prepare(`SELECT COUNT(*) AS n FROM cards`).first<{ n: number }>())?.n ?? 0;
	return { sets, cards };
}
