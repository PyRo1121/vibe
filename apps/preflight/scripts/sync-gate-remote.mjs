#!/usr/bin/env node
/**
 * Copies scripts/gate-remote.mjs → static/gate-remote.mjs and injects canonical P0 IDs
 * from src/lib/scan/p0-ids.ts (run after changing P0_CHECK_IDS).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const p0Source = readFileSync(join(root, 'src/lib/scan/p0-ids.ts'), 'utf8');
const match = p0Source.match(/export const P0_CHECK_IDS = \[([\s\S]*?)\] as const/);
if (!match) {
	console.error('Could not parse P0_CHECK_IDS from p0-ids.ts');
	process.exit(1);
}

const ids = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const p0Block = `const P0_IDS = new Set([\n${ids.map((id) => `\t'${id}'`).join(',\n')}\n]);`;

for (const rel of ['scripts/gate-remote.mjs', 'static/gate-remote.mjs']) {
	const path = join(root, rel);
	let content = readFileSync(path, 'utf8');
	if (!/const P0_IDS = new Set\(\[[\s\S]*?\]\);/.test(content)) {
		console.error(`P0_IDS block not found in ${rel}`);
		process.exit(1);
	}
	const replaced = content.replace(/const P0_IDS = new Set\(\[[\s\S]*?\]\);/, p0Block);
	writeFileSync(path, replaced);
	console.log(`✓ ${rel} — ${ids.length} P0 IDs`);
}
