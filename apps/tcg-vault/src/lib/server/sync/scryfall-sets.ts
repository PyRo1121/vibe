export const SCRYFALL_USER_AGENT = 'TCGVault/1.0 (https://vault.latham.cloud; olen@latham.cloud)';

export const SCRYFALL_HEADERS = {
	Accept: 'application/json',
	'User-Agent': SCRYFALL_USER_AGENT
} as const;

/** Set types we skip — tokens/memorabilia aren't useful for price/checklist SEO. */
export const SCRYFALL_EXCLUDED_SET_TYPES = new Set(['token', 'memorabilia', 'minigame']);

export interface ScryfallSetSummary {
	code: string;
	name: string;
	released_at: string | null;
	card_count: number;
	set_type: string;
}

export async function listScryfallMtgSets(): Promise<ScryfallSetSummary[]> {
	const res = await fetch('https://api.scryfall.com/sets', { headers: SCRYFALL_HEADERS });
	if (!res.ok) {
		throw new Error(`Scryfall sets error ${res.status}`);
	}

	const body = (await res.json()) as {
		data: {
			code: string;
			name: string;
			released_at: string | null;
			card_count: number;
			set_type: string;
			digital?: boolean;
		}[];
	};

	return body.data
		.filter((set) => !SCRYFALL_EXCLUDED_SET_TYPES.has(set.set_type))
		.filter((set) => set.card_count > 0)
		.filter((set) => !set.digital)
		.toSorted((a, b) => {
			const aDate = a.released_at ?? '';
			const bDate = b.released_at ?? '';
			return bDate.localeCompare(aDate) || a.name.localeCompare(b.name);
		});
}
