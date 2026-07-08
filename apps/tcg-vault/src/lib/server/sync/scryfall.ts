import { slugify } from '$lib/games';
import type { Db } from '$lib/server/db';
import { SCRYFALL_HEADERS } from '$lib/server/sync/scryfall-sets';

interface ScryfallCard {
	id: string;
	name: string;
	set: string;
	set_name: string;
	collector_number: string;
	rarity: string;
	released_at?: string;
	image_uris?: { normal?: string; small?: string };
	card_faces?: { image_uris?: { normal?: string } }[];
	prices?: {
		usd?: string | null;
		usd_foil?: string | null;
		usd_etched?: string | null;
		eur?: string | null;
	};
}

interface ScryfallList {
	object: string;
	data: ScryfallCard[];
	has_more: boolean;
	next_page?: string;
}

const BATCH_SIZE = 90;

function cardImage(card: ScryfallCard): string | null {
	if (card.image_uris?.normal) return card.image_uris.normal;
	return card.card_faces?.[0]?.image_uris?.normal ?? null;
}

function parseUsd(value: string | null | undefined): number | null {
	if (!value) return null;
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? n : null;
}

export interface ScryfallSetImportResult {
	setCode: string;
	setName: string;
	cardsImported: number;
}

export async function importScryfallSet(db: Db, setCode: string): Promise<ScryfallSetImportResult> {
	const code = setCode.toLowerCase();
	let url: string | undefined = `https://api.scryfall.com/cards/search?q=set:${code}&unique=prints`;
	let cardsImported = 0;
	let setName = code.toUpperCase();
	let setId = `mtg-${code}`;
	const setSlug = slugify(code);
	const now = new Date().toISOString();
	const batch: D1PreparedStatement[] = [];

	const flush = async () => {
		if (batch.length === 0) return;
		const chunk = batch.splice(0, batch.length);
		await db.batch(chunk);
	};

	const queue = async (statement: D1PreparedStatement) => {
		batch.push(statement);
		if (batch.length >= BATCH_SIZE) await flush();
	};

	while (url) {
		const res = await fetch(url, { headers: SCRYFALL_HEADERS });
		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Scryfall error ${res.status}: ${body.slice(0, 200)}`);
		}
		const page = (await res.json()) as ScryfallList;
		if (page.object === 'error') {
			throw new Error(`Scryfall: ${JSON.stringify(page)}`);
		}

		for (const card of page.data) {
			setName = card.set_name;
			setId = `mtg-${card.set}`;
			const cardSlug = slugify(`${card.collector_number}-${card.name}`);
			const cardId = `mtg-${card.id}`;

			await queue(
				db
					.prepare(
						`INSERT INTO sets (id, game_slug, slug, name, code, released_at, card_count)
           VALUES (?, 'mtg', ?, ?, ?, ?, 0)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, code = excluded.code`
					)
					.bind(setId, setSlug, card.set_name, card.set, card.released_at ?? null)
			);

			await queue(
				db
					.prepare(
						`INSERT INTO cards (id, game_slug, set_id, slug, name, collector_number, rarity, image_source_url, external_id)
           VALUES (?, 'mtg', ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             collector_number = excluded.collector_number,
             rarity = excluded.rarity,
             image_source_url = excluded.image_source_url`
					)
					.bind(
						cardId,
						setId,
						cardSlug,
						card.name,
						card.collector_number,
						card.rarity,
						cardImage(card),
						card.id
					)
			);

			const marketUsd =
				parseUsd(card.prices?.usd) ??
				parseUsd(card.prices?.usd_foil) ??
				parseUsd(card.prices?.usd_etched);

			await queue(
				db
					.prepare(
						`INSERT INTO prices (card_id, market_usd, market_usd_foil, market_eur, ebay_usd, price_source, updated_at)
           VALUES (?, ?, ?, ?, NULL, 'scryfall', ?)
           ON CONFLICT(card_id) DO UPDATE SET
             market_usd = excluded.market_usd,
             market_usd_foil = excluded.market_usd_foil,
             market_eur = excluded.market_eur,
             price_source = excluded.price_source,
             updated_at = excluded.updated_at`
					)
					.bind(cardId, marketUsd, parseUsd(card.prices?.usd_foil), parseUsd(card.prices?.eur), now)
			);

			cardsImported += 1;
		}

		await flush();

		url = page.has_more ? page.next_page : undefined;
		if (url) await new Promise((resolve) => setTimeout(resolve, 100));
	}

	await db.prepare(`UPDATE sets SET card_count = ? WHERE id = ?`).bind(cardsImported, setId).run();

	return { setCode: code, setName, cardsImported };
}

export { listScryfallMtgSets } from '$lib/server/sync/scryfall-sets';
