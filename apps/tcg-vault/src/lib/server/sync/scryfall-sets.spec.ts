import { afterEach, describe, expect, it, vi } from 'vitest';

import { listScryfallMtgSets, SCRYFALL_HEADERS } from './scryfall-sets';

describe('listScryfallMtgSets', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('fetches sets with Scryfall headers, filters non-catalog sets, and sorts newest first', async () => {
		const fetchMock = vi.fn<typeof fetch>(async () =>
			Response.json({
				data: [
					{
						code: 'old',
						name: 'Old Set',
						released_at: '1999-01-01',
						card_count: 10,
						set_type: 'expansion'
					},
					{
						code: 'tok',
						name: 'Token Set',
						released_at: '2024-01-01',
						card_count: 20,
						set_type: 'token'
					},
					{
						code: 'dig',
						name: 'Digital Set',
						released_at: '2025-01-01',
						card_count: 20,
						set_type: 'expansion',
						digital: true
					},
					{
						code: 'new',
						name: 'New Set',
						released_at: '2024-02-02',
						card_count: 12,
						set_type: 'expansion'
					},
					{
						code: 'same-b',
						name: 'Beta Same Date',
						released_at: '2024-02-02',
						card_count: 5,
						set_type: 'expansion'
					},
					{
						code: 'same-a',
						name: 'Alpha Same Date',
						released_at: '2024-02-02',
						card_count: 5,
						set_type: 'expansion'
					},
					{
						code: 'nodate',
						name: 'No Date Set',
						released_at: null,
						card_count: 1,
						set_type: 'expansion',
						digital: false
					},
					{
						code: 'empty',
						name: 'Empty Set',
						released_at: '2026-01-01',
						card_count: 0,
						set_type: 'expansion'
					}
				]
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(listScryfallMtgSets()).resolves.toEqual([
			{
				code: 'same-a',
				name: 'Alpha Same Date',
				released_at: '2024-02-02',
				card_count: 5,
				set_type: 'expansion'
			},
			{
				code: 'same-b',
				name: 'Beta Same Date',
				released_at: '2024-02-02',
				card_count: 5,
				set_type: 'expansion'
			},
			{
				code: 'new',
				name: 'New Set',
				released_at: '2024-02-02',
				card_count: 12,
				set_type: 'expansion'
			},
			{
				code: 'old',
				name: 'Old Set',
				released_at: '1999-01-01',
				card_count: 10,
				set_type: 'expansion'
			},
			{
				code: 'nodate',
				name: 'No Date Set',
				released_at: null,
				card_count: 1,
				set_type: 'expansion',
				digital: false
			}
		]);
		expect(fetchMock).toHaveBeenCalledWith('https://api.scryfall.com/sets', {
			headers: SCRYFALL_HEADERS
		});
	});

	it('throws on Scryfall set API failures', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>(async () => new Response('bad gateway', { status: 502 }))
		);

		await expect(listScryfallMtgSets()).rejects.toThrow('Scryfall sets error 502');
	});
});
