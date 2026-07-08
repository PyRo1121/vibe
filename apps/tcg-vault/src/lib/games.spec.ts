import { describe, expect, it } from 'vitest';

import { GAMES, getGame, slugify } from './games';

describe('games catalog helpers', () => {
	it('finds configured game metadata by slug', () => {
		expect(getGame('mtg')).toMatchObject({
			name: 'Magic: The Gathering',
			status: 'live'
		});
		expect(getGame('missing')).toBeUndefined();
	});

	it('keeps the expected launch catalog shape', () => {
		expect(GAMES.map((game) => game.slug)).toEqual([
			'mtg',
			'yugioh',
			'pokemon',
			'lorcana',
			'one-piece',
			'digimon',
			'fab',
			'swu'
		]);
		expect(GAMES.every((game) => game.name && game.tagline && game.accent)).toBe(true);
	});

	it('normalizes names into bounded URL slugs', () => {
		expect(slugify('  Black Lotus #001 - Foil!  ')).toBe('black-lotus-001-foil');
		expect(slugify('x'.repeat(140))).toHaveLength(120);
	});
});
