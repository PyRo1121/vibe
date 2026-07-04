-- TCG Vault — core schema

CREATE TABLE IF NOT EXISTS games (
	slug TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	tagline TEXT,
	sort_order INTEGER NOT NULL DEFAULT 0,
	enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sets (
	id TEXT PRIMARY KEY,
	game_slug TEXT NOT NULL,
	slug TEXT NOT NULL,
	name TEXT NOT NULL,
	code TEXT,
	released_at TEXT,
	card_count INTEGER NOT NULL DEFAULT 0,
	FOREIGN KEY (game_slug) REFERENCES games (slug),
	UNIQUE (game_slug, slug)
);

CREATE TABLE IF NOT EXISTS cards (
	id TEXT PRIMARY KEY,
	game_slug TEXT NOT NULL,
	set_id TEXT NOT NULL,
	slug TEXT NOT NULL,
	name TEXT NOT NULL,
	collector_number TEXT,
	rarity TEXT,
	image_source_url TEXT,
	image_r2_key TEXT,
	external_id TEXT,
	FOREIGN KEY (game_slug) REFERENCES games (slug),
	FOREIGN KEY (set_id) REFERENCES sets (id),
	UNIQUE (game_slug, set_id, slug)
);

CREATE TABLE IF NOT EXISTS prices (
	card_id TEXT PRIMARY KEY,
	market_usd REAL,
	market_usd_foil REAL,
	market_eur REAL,
	ebay_usd REAL,
	price_source TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (card_id) REFERENCES cards (id)
);

CREATE TABLE IF NOT EXISTS price_history (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	card_id TEXT NOT NULL,
	market_usd REAL,
	recorded_at TEXT NOT NULL,
	FOREIGN KEY (card_id) REFERENCES cards (id)
);

CREATE INDEX IF NOT EXISTS idx_sets_game ON sets (game_slug);
CREATE INDEX IF NOT EXISTS idx_cards_game_set ON cards (game_slug, set_id);
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards (name);
CREATE INDEX IF NOT EXISTS idx_price_history_card ON price_history (card_id, recorded_at);

CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	email TEXT UNIQUE,
	stripe_customer_id TEXT,
	plan TEXT NOT NULL DEFAULT 'free',
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_items (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	card_id TEXT NOT NULL,
	quantity INTEGER NOT NULL DEFAULT 1,
	condition TEXT NOT NULL DEFAULT 'near_mint',
	added_at TEXT NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users (id),
	FOREIGN KEY (card_id) REFERENCES cards (id),
	UNIQUE (user_id, card_id, condition)
);

INSERT OR IGNORE INTO games (slug, name, tagline, sort_order) VALUES
	('mtg', 'Magic: The Gathering', 'Prices, sets, and collection tracking', 1),
	('yugioh', 'Yu-Gi-Oh!', 'Market prices and deck collection', 2),
	('pokemon', 'Pokémon TCG', 'Card prices and set completion', 3),
	('lorcana', 'Disney Lorcana', 'Enchanted prices and checklists', 4),
	('one-piece', 'One Piece TCG', 'Leader prices and set values', 5),
	('digimon', 'Digimon TCG', 'Collection and market data', 6),
	('fab', 'Flesh and Blood', 'Competitive card prices', 7),
	('swu', 'Star Wars Unlimited', 'Galaxy-wide price guide', 8);
