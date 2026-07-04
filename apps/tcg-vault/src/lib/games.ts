export type GameSlug =
	'mtg' | 'yugioh' | 'pokemon' | 'lorcana' | 'one-piece' | 'digimon' | 'fab' | 'swu';

export interface GameMeta {
	slug: GameSlug;
	name: string;
	tagline: string;
	accent: string;
	status: 'live' | 'syncing' | 'soon';
}

export const GAMES: GameMeta[] = [
	{
		slug: 'mtg',
		name: 'Magic: The Gathering',
		tagline: 'Scryfall-powered prices',
		accent: 'from-amber-500/20 to-orange-600/10',
		status: 'live'
	},
	{
		slug: 'yugioh',
		name: 'Yu-Gi-Oh!',
		tagline: 'TCGPlayer + eBay from YGOProDeck',
		accent: 'from-violet-500/20 to-purple-700/10',
		status: 'syncing'
	},
	{
		slug: 'pokemon',
		name: 'Pokémon TCG',
		tagline: 'Catalog + market sync',
		accent: 'from-yellow-400/20 to-red-500/10',
		status: 'syncing'
	},
	{
		slug: 'lorcana',
		name: 'Disney Lorcana',
		tagline: 'Coming with price API upgrade',
		accent: 'from-sky-400/20 to-indigo-600/10',
		status: 'soon'
	},
	{
		slug: 'one-piece',
		name: 'One Piece TCG',
		tagline: 'OPTG catalog sync',
		accent: 'from-red-500/20 to-rose-700/10',
		status: 'soon'
	},
	{
		slug: 'digimon',
		name: 'Digimon TCG',
		accent: 'from-blue-500/20 to-cyan-600/10',
		tagline: 'Planned',
		status: 'soon'
	},
	{
		slug: 'fab',
		name: 'Flesh and Blood',
		tagline: 'Planned',
		accent: 'from-slate-400/20 to-zinc-600/10',
		status: 'soon'
	},
	{
		slug: 'swu',
		name: 'Star Wars Unlimited',
		tagline: 'Planned',
		accent: 'from-stone-400/20 to-neutral-600/10',
		status: 'soon'
	}
];

export function getGame(slug: string): GameMeta | undefined {
	return GAMES.find((g) => g.slug === slug);
}

export function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 120);
}
