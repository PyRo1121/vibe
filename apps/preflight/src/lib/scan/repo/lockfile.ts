import { describeNpmDependency } from '$lib/scan/license';
import type { DetectedLibrary } from '$lib/scan/types';

/**
 * Lockfile analysis — the full transitive dependency tree, not just the
 * direct deps in package.json. Pure parsing, no network.
 */

export interface LockPackage {
	name: string;
	version: string;
}

/** Keeps the OSV batch payload and Worker memory bounded on giant monorepos. */
export const MAX_LOCK_PACKAGES = 800;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readLockDependencyMap(
	value: unknown
): Record<string, { dependencies?: unknown; version?: string }> {
	if (!isRecord(value)) return {};
	return Object.fromEntries(
		Object.entries(value)
			.filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
			.map(([name, info]) => [
				name,
				{
					dependencies: info.dependencies,
					version: typeof info.version === 'string' ? info.version : undefined
				}
			])
	);
}

/**
 * Parse npm package-lock.json (v1 nested `dependencies`, or v2/v3 flat
 * `packages` keyed by node_modules path). Returns unique name@version pairs.
 */
export function parsePackageLock(text: string | null): LockPackage[] {
	if (!text) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return [];
	}

	const seen = new Map<string, LockPackage>();
	const add = (name: string, version: string | undefined) => {
		if (!name || !version || seen.size >= MAX_LOCK_PACKAGES) return;
		const key = `${name}@${version}`;
		if (!seen.has(key)) seen.set(key, { name, version });
	};

	const root = isRecord(parsed) ? parsed : {};
	const packages = readLockDependencyMap(root.packages);
	if (Object.keys(packages).length > 0) {
		for (const [path, info] of Object.entries(packages)) {
			if (path === '') continue; // the root project itself
			// "node_modules/foo" or "node_modules/@scope/foo" or nested "…/node_modules/bar"
			const idx = path.lastIndexOf('node_modules/');
			if (idx === -1) continue; // workspace package, not a dependency
			add(path.slice(idx + 'node_modules/'.length), info.version);
		}
		return [...seen.values()];
	}

	const walk = (deps: ReturnType<typeof readLockDependencyMap>) => {
		for (const [name, info] of Object.entries(deps)) {
			add(name, info.version);
			walk(readLockDependencyMap(info.dependencies));
		}
	};
	walk(readLockDependencyMap(root.dependencies));
	return [...seen.values()];
}

/**
 * Screen the full lockfile tree against the curated license database — free
 * (no network), catches copyleft/non-commercial packages hiding in the
 * transitive tree that a package.json-only audit misses.
 */
export function screenTransitiveLicenses(packages: LockPackage[]): DetectedLibrary[] {
	const flagged: DetectedLibrary[] = [];
	for (const pkg of packages) {
		const described = describeNpmDependency(pkg.name, pkg.version, null);
		// Only curated hits are trustworthy without a registry lookup; 'unknown'
		// fallbacks would flood the report with noise.
		if (described.category !== 'unknown' && described.sellable !== 'yes') {
			flagged.push({ ...described, source: 'package-lock.json (transitive)' });
		}
	}
	return flagged;
}
