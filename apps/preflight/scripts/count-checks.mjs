#!/usr/bin/env node
/**
 * Count unique Deploylint check/finding IDs (for honest check-count marketing).
 * Run: npm run count:checks -w preflight
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const scanDir = join(import.meta.dirname, '../src/lib/scan');

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path, out);
		else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path);
	}
	return out;
}

const ids = new Set();
const patterns = [
	/makeCheck\(\s*['"]([a-z0-9-]+)['"]/g,
	/\bcheck\(\s*['"]([a-z0-9-]+)['"]/g,
	/\bfinding\(\s*['"]([a-z0-9-]+)['"]/g,
	/\bid:\s*['"]([a-z0-9-]+)['"]/g
];

for (const file of walk(scanDir)) {
	if (file.endsWith('catalog.ts')) continue;
	const text = readFileSync(file, 'utf8');
	for (const pattern of patterns) {
		for (const m of text.matchAll(pattern)) ids.add(m[1]);
	}
}

const sorted = [...ids].toSorted();
console.log(`Unique check/finding IDs: ${sorted.length}`);
console.log(sorted.join('\n'));
