import { beforeEach, describe, expect, it, vi } from 'vitest';

import { load as loadLayout } from './+layout.server';
import { load as loadHome } from './+page.server';
import { load as loadGame } from './[game]/+page.server';
import { load as loadSet } from './[game]/[set]/+page.server';
import { load as loadCard } from './[game]/[set]/[card]/+page.server';
import { GET, POST } from './api/sync/scryfall/+server';

const syncMocks = vi.hoisted(() => ({
	importScryfallSet: vi.fn<
		(
			db: unknown,
			setCode: string
		) => Promise<{
			setCode: string;
			setName: string;
			cardsImported: number;
		}>
	>(),
	listScryfallMtgSets: vi.fn<
		() => Promise<
			Array<{
				code: string;
				name: string;
				released_at: string | null;
				card_count: number;
				set_type: string;
			}>
		>
	>()
}));

vi.mock('$lib/server/sync/scryfall', () => ({
	importScryfallSet: syncMocks.importScryfallSet,
	listScryfallMtgSets: syncMocks.listScryfallMtgSets
}));

const set = {
	id: 'mtg-lea',
	game_slug: 'mtg',
	slug: 'limited-edition-alpha',
	name: 'Limited Edition Alpha',
	code: 'lea',
	released_at: '1993-08-05',
	card_count: 295
};
const card = {
	id: 'mtg-card-1',
	game_slug: 'mtg',
	set_id: 'mtg-lea',
	slug: '1-black-lotus',
	name: 'Black Lotus',
	collector_number: '1',
	rarity: 'rare',
	image_source_url: null,
	image_r2_key: null,
	external_id: 'card-1',
	set_slug: 'limited-edition-alpha',
	set_name: 'Limited Edition Alpha',
	market_usd: 100,
	market_usd_foil: null,
	market_eur: null,
	ebay_usd: null,
	price_source: 'scryfall',
	price_updated_at: '2026-01-01T00:00:00.000Z'
};
const pricelessCard = {
	...card,
	id: 'mtg-card-2',
	slug: '2-no-price',
	name: 'No Price',
	market_usd: null
};

type FakeRow = typeof set | typeof card | typeof pricelessCard | { n: number };

interface FakeStatement {
	sql: string;
	values: unknown[];
	bind: (...values: unknown[]) => FakeStatement;
	all: () => Promise<{ results: FakeRow[] }>;
	first: () => Promise<FakeRow | null>;
}

function createPlatform(options: { missingSet?: boolean; missingCard?: boolean } = {}) {
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
					if (sql.includes('FROM cards')) return { results: [card, pricelessCard] };
					return { results: [set] };
				},
				async first() {
					if (sql.includes('COUNT(*) AS n')) {
						return { n: sql.includes('FROM sets') ? 1 : 2 };
					}
					if (sql.includes('FROM cards')) {
						return options.missingCard ? null : card;
					}
					return options.missingSet ? null : set;
				}
			};
			return statement;
		}
	};
	return {
		env: {
			DB: db,
			SYNC_SECRET: 'secret',
			PUBLIC_SITE_NAME: 'Cards',
			PUBLIC_SITE_URL: 'https://cards.test'
		}
	} as unknown as App.Platform;
}

function request(token = 'secret') {
	return new Request('https://vault.test/api/sync/scryfall?set=LEA', {
		method: 'POST',
		headers: { authorization: `Bearer ${token}` }
	});
}

async function captureError(run: () => unknown): Promise<unknown> {
	try {
		return await run();
	} catch (err) {
		return err;
	}
}

describe('TCG Vault server entrypoints', () => {
	beforeEach(() => {
		syncMocks.importScryfallSet.mockReset();
		syncMocks.listScryfallMtgSets.mockReset();
		syncMocks.importScryfallSet.mockResolvedValue({
			setCode: 'lea',
			setName: 'Limited Edition Alpha',
			cardsImported: 2
		});
		syncMocks.listScryfallMtgSets.mockResolvedValue([
			{
				code: 'lea',
				name: 'Limited Edition Alpha',
				released_at: '1993-08-05',
				card_count: 295,
				set_type: 'core'
			}
		]);
	});

	it('loads layout defaults and configured public site metadata', () => {
		expect(loadLayout({ platform: undefined } as never)).toEqual({
			siteName: 'TCG Vault',
			siteUrl: 'https://vault.latham.cloud'
		});
		expect(loadLayout({ platform: createPlatform() } as never)).toEqual({
			siteName: 'Cards',
			siteUrl: 'https://cards.test'
		});
	});

	it('loads home catalog counts when DB is bound', async () => {
		await expect(loadHome({ platform: createPlatform() } as never)).resolves.toMatchObject({
			catalog: { sets: 1, cards: 2 }
		});
		await expect(loadHome({ platform: undefined } as never)).resolves.toMatchObject({
			catalog: { sets: 0, cards: 0 }
		});
	});

	it('loads game, set, and card pages from D1 data', async () => {
		await expect(
			loadGame({ params: { game: 'mtg' }, platform: createPlatform() } as never)
		).resolves.toMatchObject({ game: { slug: 'mtg' }, sets: [set] });
		await expect(
			loadSet({
				params: { game: 'mtg', set: 'limited-edition-alpha' },
				platform: createPlatform()
			} as never)
		).resolves.toMatchObject({
			game: { slug: 'mtg' },
			set,
			cards: [card, pricelessCard],
			totalValue: 100
		});
		await expect(
			loadCard({
				params: { game: 'mtg', set: 'limited-edition-alpha', card: '1-black-lotus' },
				platform: createPlatform()
			} as never)
		).resolves.toMatchObject({ game: { slug: 'mtg' }, card });
	});

	it('throws route errors for missing games, sets, and cards', async () => {
		await expect(
			captureError(() =>
				loadGame({ params: { game: 'bad-game' }, platform: createPlatform() } as never)
			)
		).resolves.toMatchObject({ body: { message: 'Game not found' }, status: 404 });
		await expect(
			captureError(() =>
				loadSet({
					params: { game: 'bad-game', set: 'limited-edition-alpha' },
					platform: createPlatform()
				} as never)
			)
		).resolves.toMatchObject({ body: { message: 'Game not found' }, status: 404 });
		await expect(
			captureError(() =>
				loadCard({
					params: { game: 'bad-game', set: 'limited-edition-alpha', card: '1-black-lotus' },
					platform: createPlatform()
				} as never)
			)
		).resolves.toMatchObject({ body: { message: 'Game not found' }, status: 404 });
		await expect(
			captureError(() =>
				loadSet({
					params: { game: 'mtg', set: 'missing-set' },
					platform: createPlatform({ missingSet: true })
				} as never)
			)
		).resolves.toMatchObject({ body: { message: 'Set not found' }, status: 404 });
		await expect(
			captureError(() =>
				loadCard({
					params: { game: 'mtg', set: 'limited-edition-alpha', card: 'missing-card' },
					platform: createPlatform({ missingCard: true })
				} as never)
			)
		).resolves.toMatchObject({ body: { message: 'Card not found' }, status: 404 });
	});

	it('lists importable Scryfall sets through the sync API', async () => {
		const response = await GET({
			platform: createPlatform(),
			request: request()
		} as never);

		await expect(response.json()).resolves.toEqual({
			count: 1,
			sets: [
				{
					code: 'lea',
					name: 'Limited Edition Alpha',
					card_count: 295,
					released_at: '1993-08-05',
					set_type: 'core'
				}
			]
		});
	});

	it('imports a requested Scryfall set through the sync API', async () => {
		const platform = createPlatform();
		const response = await POST({
			platform,
			request: request(),
			url: new URL('https://vault.test/api/sync/scryfall?set=LEA')
		} as never);

		await expect(response.json()).resolves.toEqual({
			ok: true,
			setCode: 'lea',
			setName: 'Limited Edition Alpha',
			cardsImported: 2
		});
		expect(syncMocks.importScryfallSet).toHaveBeenCalledWith(platform.env.DB, 'LEA');
	});

	it('reports sync API validation and upstream failures', async () => {
		await expect(
			captureError(() =>
				POST({
					platform: createPlatform(),
					request: request(),
					url: new URL('https://vault.test/api/sync/scryfall')
				} as never)
			)
		).resolves.toMatchObject({ body: { message: 'Missing ?set=CODE query param' }, status: 400 });

		await expect(
			captureError(() => GET({ platform: createPlatform(), request: request('wrong') } as never))
		).resolves.toMatchObject({ body: { message: 'Unauthorized' }, status: 401 });

		syncMocks.importScryfallSet.mockRejectedValueOnce(new Error('Scryfall unavailable'));
		await expect(
			captureError(() =>
				POST({
					platform: createPlatform(),
					request: request(),
					url: new URL('https://vault.test/api/sync/scryfall?set=LEA')
				} as never)
			)
		).resolves.toMatchObject({ body: { message: 'Scryfall unavailable' }, status: 502 });

		syncMocks.importScryfallSet.mockRejectedValueOnce('unexpected');
		await expect(
			captureError(() =>
				POST({
					platform: createPlatform(),
					request: request(),
					url: new URL('https://vault.test/api/sync/scryfall?set=LEA')
				} as never)
			)
		).resolves.toMatchObject({ body: { message: 'Sync failed' }, status: 502 });

		syncMocks.listScryfallMtgSets.mockRejectedValueOnce(new Error('List unavailable'));
		await expect(
			captureError(() => GET({ platform: createPlatform(), request: request() } as never))
		).resolves.toMatchObject({ body: { message: 'List unavailable' }, status: 502 });

		syncMocks.listScryfallMtgSets.mockRejectedValueOnce('unexpected');
		await expect(
			captureError(() => GET({ platform: createPlatform(), request: request() } as never))
		).resolves.toMatchObject({ body: { message: 'Failed to list sets' }, status: 502 });
	});
});
