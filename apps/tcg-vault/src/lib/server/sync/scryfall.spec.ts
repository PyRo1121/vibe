import { afterEach, describe, expect, it, vi } from 'vitest';

import { importScryfallSet } from './scryfall';

interface FakeStatement {
	sql: string;
	values: unknown[];
	bind: (...values: unknown[]) => FakeStatement;
	run: () => Promise<{ success: true }>;
}

function createSyncDb() {
	const statements: FakeStatement[] = [];
	const batches: FakeStatement[][] = [];

	const db = {
		prepare(sql: string) {
			const statement: FakeStatement = {
				sql,
				values: [],
				bind(...values: unknown[]) {
					statement.values = values;
					return statement;
				},
				async run() {
					return { success: true };
				}
			};
			statements.push(statement);
			return statement;
		},
		async batch(batch: FakeStatement[]) {
			batches.push(batch);
			return [];
		}
	};

	return { db, statements, batches };
}

describe('importScryfallSet', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('imports cards, prices, image fallbacks, and final card count', async () => {
		const firstPage = {
			object: 'list',
			has_more: true,
			next_page: 'https://api.scryfall.test/page-2',
			data: [
				{
					id: 'card-1',
					name: 'Black Lotus',
					set: 'lea',
					set_name: 'Limited Edition Alpha',
					collector_number: '1',
					rarity: 'rare',
					released_at: '1993-08-05',
					image_uris: { normal: 'https://img.test/lotus.jpg' },
					prices: { usd: '100000.50', usd_foil: null, eur: '90000.25' }
				}
			]
		};
		const secondPage = {
			object: 'list',
			has_more: false,
			data: [
				{
					id: 'card-2',
					name: 'Chaos Orb',
					set: 'lea',
					set_name: 'Limited Edition Alpha',
					collector_number: '2',
					rarity: 'rare',
					card_faces: [{ image_uris: { normal: 'https://img.test/orb.jpg' } }],
					prices: { usd: null, usd_foil: '2000.00', usd_etched: '1500.00', eur: null }
				},
				{
					id: 'card-3',
					name: 'No Price',
					set: 'lea',
					set_name: 'Limited Edition Alpha',
					collector_number: '3',
					rarity: 'common',
					prices: { usd: 'not-a-number', usd_foil: null, usd_etched: null, eur: 'also-bad' }
				}
			]
		};
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(Response.json(firstPage))
			.mockResolvedValueOnce(Response.json(secondPage));
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal('setTimeout', (callback: () => void) => {
			callback();
			return 0 as unknown as NodeJS.Timeout;
		});
		const { db, statements, batches } = createSyncDb();

		await expect(importScryfallSet(db as never, 'LEA')).resolves.toEqual({
			setCode: 'lea',
			setName: 'Limited Edition Alpha',
			cardsImported: 3
		});
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			'https://api.scryfall.com/cards/search?q=set:lea&unique=prints',
			expect.objectContaining({ headers: expect.any(Object) })
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			'https://api.scryfall.test/page-2',
			expect.objectContaining({ headers: expect.any(Object) })
		);
		expect(batches).toHaveLength(2);
		expect(statements.map((statement) => statement.values)).toEqual(
			expect.arrayContaining([
				['mtg-lea', 'lea', 'Limited Edition Alpha', 'lea', '1993-08-05'],
				[
					'mtg-card-1',
					'mtg-lea',
					'1-black-lotus',
					'Black Lotus',
					'1',
					'rare',
					'https://img.test/lotus.jpg',
					'card-1'
				],
				[
					'mtg-card-2',
					'mtg-lea',
					'2-chaos-orb',
					'Chaos Orb',
					'2',
					'rare',
					'https://img.test/orb.jpg',
					'card-2'
				],
				['mtg-card-3', 'mtg-lea', '3-no-price', 'No Price', '3', 'common', null, 'card-3'],
				['mtg-card-2', 2000, 2000, null, expect.any(String)],
				['mtg-card-3', null, null, null, expect.any(String)],
				[3, 'mtg-lea']
			])
		);
	});

	it('throws useful errors for failed Scryfall responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>(async () => new Response('rate limited', { status: 429 }))
		);
		const { db } = createSyncDb();

		await expect(importScryfallSet(db as never, 'lea')).rejects.toThrow(
			'Scryfall error 429: rate limited'
		);
	});

	it('throws Scryfall error payloads returned as JSON lists', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>(async () =>
				Response.json({
					object: 'error',
					code: 'not_found'
				})
			)
		);
		const { db } = createSyncDb();

		await expect(importScryfallSet(db as never, 'lea')).rejects.toThrow('Scryfall:');
	});
});
