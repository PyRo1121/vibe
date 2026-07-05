#!/usr/bin/env node
/**
 * Count unique Deploylint check IDs (for honest "90+ checks" marketing).
 * Run: npm run count:checks -w preflight
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scanDir = join(dirname(fileURLToPath(import.meta.url)), '../src/lib/scan');

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path, out);
		else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path);
	}
	return out;
}

const ids = new Set();
for (const file of walk(scanDir)) {
	const text = readFileSync(file, 'utf8');
	for (const m of text.matchAll(/makeCheck\(\s*['"]([a-z0-9-]+)['"]/g)) ids.add(m[1]);
}

const sorted = [...ids].sort();
console.log(`Unique check IDs: ${sorted.length}`);
console.log(sorted.join('\n'));
