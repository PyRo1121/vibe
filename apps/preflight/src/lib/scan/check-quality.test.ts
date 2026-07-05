import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CHECK_CATALOG } from './catalog';
import type { CheckCatalogEntry } from './catalog';

const scanDir = dirname(fileURLToPath(import.meta.url));
const catalogById: Record<string, CheckCatalogEntry | undefined> = CHECK_CATALOG;

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) walk(path, out);
		else if (name.endsWith('.ts')) out.push(path);
	}
	return out;
}

function sourceFiles(): string[] {
	return walk(scanDir).filter((file) => !file.endsWith('.test.ts'));
}

function testFiles(): string[] {
	return walk(scanDir).filter((file) => {
		if (!file.endsWith('.test.ts')) return false;
		const basename = file.split(/[\\/]/).at(-1);
		return basename !== 'catalog.test.ts' && basename !== 'check-quality.test.ts';
	});
}

function emittedCheckIds(): string[] {
	const ids = new Set<string>();
	const patterns = [
		/makeCheck\(\s*['"]([a-z0-9-]+)['"]/g,
		/\bcheck\(\s*['"]([a-z0-9-]+)['"]/g,
		/\bfinding\(\s*['"]([a-z0-9-]+)['"]/g,
		/\bid:\s*['"]([a-z0-9-]+)['"]/g
	];

	for (const file of sourceFiles()) {
		const text = readFileSync(file, 'utf8');
		for (const pattern of patterns) {
			for (const match of text.matchAll(pattern)) {
				ids.add(match[1]);
			}
		}
	}

	return [...ids].toSorted();
}

function behavioralTestReferences(): Map<string, string[]> {
	const references = new Map<string, string[]>();

	for (const file of testFiles()) {
		const text = readFileSync(file, 'utf8');
		for (const id of emittedCheckIds()) {
			if (!text.includes(id)) continue;
			const files = references.get(id) ?? [];
			files.push(relative(scanDir, file).replaceAll('\\', '/'));
			references.set(id, files);
		}
	}

	return references;
}

describe('check quality guardrails', () => {
	it('catalogs every emitted static check id with detection rationale', () => {
		const missing = emittedCheckIds().filter((id) => catalogById[id] == null);

		expect(missing).toEqual([]);
		for (const id of emittedCheckIds()) {
			const entry = catalogById[id];
			expect(entry, `${id} needs a catalog entry`).toBeDefined();
			if (!entry) continue;
			expect(entry.id).toBe(id);
			expect(entry.why.length, `${id} needs launch/business rationale`).toBeGreaterThan(40);
			expect(entry.detectedBy.length, `${id} needs detection rationale`).toBeGreaterThan(30);
			expect(
				entry.falsePositive?.length ?? 0,
				`${id} needs false-positive guidance`
			).toBeGreaterThan(30);
		}
	});

	it('keeps every emitted static check id anchored to behavioral tests', () => {
		const references = behavioralTestReferences();
		const untested = emittedCheckIds().filter((id) => !references.has(id));

		expect(untested).toEqual([]);
	});
});
