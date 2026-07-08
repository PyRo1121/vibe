import { describe, expect, it } from 'vitest';

import {
	countCatalog,
	getCard,
	getSet,
	listCardsInSet,
	listSets,
	type CardWithPrice,
	type Db,
	type SetRow
} from './db';

type FakeRow = SetRow | CardWithPrice | { n: number };

interface FakeStatement {
	sql: string;
	values: unknown[];
	bind: (...values: unknown[]) => FakeStatement;
	all: () => Promise<{ results: FakeRow[] | undefined }>;
	first: () => Promise<FakeRow | null>;
	run: () => Promise<{ success: true }>;
}

function createDb(
	options: { emptyResults?: boolean; missingFirst?: boolean; missingCounts?: boolean } = {}
) {
	const statements: FakeStatement[] = [];
	const setRow: SetRow = {
		id: 'mtg-lea',
		game_slug: 'mtg',
		slug: 'limited-edition-alpha',
		name: 'Limited Edition Alpha',
		code: 'lea',
		released_at: '1993-08-05',
		card_count: 295
	};
	const cardRow: CardWithPrice = {
		id: 'mtg-card',
		game_slug: 'mtg',
		set_id: 'mtg-lea',
		slug: '1-black-lotus',
		name: 'Black Lotus',
		collector_number: '1',
		rarity: 'rare',
		image_source_url: 'https://img.test/lotus.jpg',
		image_r2_key: null,
		external_id: 'scryfall-id',
		set_slug: 'limited-edition-alpha',
		set_name: 'Limited Edition Alpha',
		market_usd: 100_000,
		market_usd_foil: null,
		market_eur: null,
		ebay_usd: null,
		price_source: 'scryfall',
		price_updated_at: '2026-01-01T00:00:00.000Z'
	};

	const db = {
		prepare(sql: string) {
			const statement: FakeStatement = {
				sql,
				values: [],
				bind(...values: unknown[]) {
					statement.values = values;
					return statement;
				},
				async all() {
					if (options.emptyResults) return { results: undefined };
					const results = sql.includes('FROM cards') ? [cardRow] : [setRow];
					return { results };
				},
				async first() {
					if (options.missingCounts && sql.includes('COUNT(*) AS n')) return null;
					if (options.missingFirst) return null;
					const value = sql.includes('COUNT(*) AS n')
						? { n: sql.includes('FROM sets') ? 2 : 7 }
						: sql.includes('FROM cards')
							? cardRow
							: setRow;
					return value;
				},
				async run() {
					return { success: true };
				}
			};
			statements.push(statement);
			return statement;
		}
	} as unknown as Db;

	return { db, statements, setRow, cardRow };
}

describe('D1 catalog accessors', () => {
	it('lists sets for a game with stable query binding', async () => {
		const { db, statements, setRow } = createDb();

		await expect(listSets(db, 'mtg')).resolves.toEqual([setRow]);
		expect(statements[0]?.values).toEqual(['mtg']);
	});

	it('loads one set by game and slug', async () => {
		const { db, statements, setRow } = createDb();

		await expect(getSet(db, 'mtg', 'limited-edition-alpha')).resolves.toEqual(setRow);
		expect(statements[0]?.values).toEqual(['mtg', 'limited-edition-alpha']);
	});

	it('lists cards and price data for a set', async () => {
		const { db, statements, cardRow } = createDb();

		await expect(listCardsInSet(db, 'mtg-lea')).resolves.toEqual([cardRow]);
		expect(statements[0]?.values).toEqual(['mtg-lea']);
	});

	it('loads a single card by game, set, and card slug', async () => {
		const { db, statements, cardRow } = createDb();

		await expect(getCard(db, 'mtg', 'limited-edition-alpha', '1-black-lotus')).resolves.toEqual(
			cardRow
		);
		expect(statements[0]?.values).toEqual(['mtg', 'limited-edition-alpha', '1-black-lotus']);
	});

	it('counts sets and cards independently', async () => {
		const { db } = createDb();

		await expect(countCatalog(db)).resolves.toEqual({ sets: 2, cards: 7 });
	});

	it('normalizes missing D1 rows into empty arrays, nulls, and zero counts', async () => {
		const empty = createDb({ emptyResults: true }).db;
		await expect(listSets(empty, 'mtg')).resolves.toEqual([]);
		await expect(listCardsInSet(empty, 'mtg-lea')).resolves.toEqual([]);

		const missingFirst = createDb({ missingFirst: true }).db;
		await expect(getSet(missingFirst, 'mtg', 'missing')).resolves.toBeNull();
		await expect(getCard(missingFirst, 'mtg', 'missing', 'card')).resolves.toBeNull();

		await expect(countCatalog(createDb({ missingCounts: true }).db)).resolves.toEqual({
			sets: 0,
			cards: 0
		});
	});
});
