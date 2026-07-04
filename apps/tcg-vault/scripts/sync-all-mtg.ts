import { getPlatformProxy } from 'wrangler';
import { importScryfallSet, listScryfallMtgSets } from '../src/lib/server/sync/scryfall.ts';

const force = process.argv.includes('--force');

async function existingSetCodes(db: D1Database): Promise<Set<string>> {
	const { results } = await db
		.prepare(`SELECT code FROM sets WHERE game_slug = 'mtg' AND code IS NOT NULL`)
		.all<{ code: string }>();
	return new Set((results ?? []).map((row) => row.code.toLowerCase()));
}

async function main() {
	const sets = await listScryfallMtgSets();
	console.log(`Scryfall MTG sets to sync: ${sets.length} (excluding token/memorabilia/digital)`);

	const { env, dispose } = await getPlatformProxy({
		configPath: './wrangler.jsonc',
		remoteBindings: true
	});

	const db = env.DB as D1Database;
	const done = force ? new Set<string>() : await existingSetCodes(db);

	let imported = 0;
	let skipped = 0;
	let failed = 0;

	for (const [index, set] of sets.entries()) {
		const code = set.code.toLowerCase();
		if (done.has(code)) {
			skipped += 1;
			continue;
		}

		const label = `[${index + 1}/${sets.length}] ${set.code.toUpperCase()} — ${set.name}`;
		process.stdout.write(`${label} ... `);

		try {
			const result = await importScryfallSet(db, code);
			imported += 1;
			console.log(`${result.cardsImported} cards`);
		} catch (err) {
			failed += 1;
			console.log('FAILED');
			console.error(err);
		}
	}

	console.log('');
	console.log(`Done. imported=${imported} skipped=${skipped} failed=${failed}`);

	await dispose();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
