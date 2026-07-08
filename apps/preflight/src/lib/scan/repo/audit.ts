import { describeNpmDependency } from '$lib/scan/license';
import type { RepoTreeEntry } from '$lib/scan/repo/github';
import type { DetectedLibrary } from '$lib/scan/types';

/** Pure repo-analysis helpers — no network, fully unit-testable. */

const ENV_EXCLUDE = /\.(example|sample|template|dist|test)$/i;
const VENDORED = /(^|\/)(node_modules|dist|build|out|vendor|\.next|\.svelte-kit|coverage)\//;

/** Committed dotenv files — .env.example and friends are fine. */
export function findCommittedEnvFiles(entries: RepoTreeEntry[]): string[] {
	return entries
		.filter((e) => e.type === 'blob')
		.map((e) => e.path)
		.filter((path) => {
			if (VENDORED.test(path)) return false;
			const file = path.split('/').pop() ?? '';
			if (!/^\.env(\..+)?$/.test(file)) return false;
			return !ENV_EXCLUDE.test(file);
		});
}

const SOURCE_EXT = /\.(js|mjs|cjs|ts|jsx|tsx|py|rb|go|php|yml|yaml|toml|json)$/i;
const HIGH_SIGNAL = /(config|settings|env|secret|constant|credential|firebase|supabase|stripe)/i;
const MAX_SAMPLE_FILES = 8;
const MAX_SAMPLE_BYTES = 200 * 1024;

/** Pick source files most likely to leak secrets: config-ish names first, then shallow files. */
export function selectSourceSamples(entries: RepoTreeEntry[]): string[] {
	const candidates = entries.filter(
		(e) =>
			e.type === 'blob' &&
			SOURCE_EXT.test(e.path) &&
			!VENDORED.test(e.path) &&
			!/(package-lock|yarn\.lock|pnpm-lock|\.min\.)/.test(e.path) &&
			(e.size === undefined || e.size <= MAX_SAMPLE_BYTES)
	);

	const score = (path: string): number => {
		const depth = path.split('/').length;
		return (HIGH_SIGNAL.test(path) ? 0 : 100) + depth;
	};

	return candidates
		.map((e) => e.path)
		.toSorted((a, b) => score(a) - score(b))
		.slice(0, MAX_SAMPLE_FILES);
}

export function findRootFile(entries: RepoTreeEntry[], pattern: RegExp): string | null {
	const match = entries.find(
		(e) => e.type === 'blob' && !e.path.includes('/') && pattern.test(e.path)
	);
	return match?.path ?? null;
}

export interface ParsedPackageJson {
	dependencies: Record<string, string>;
	valid: boolean;
	raw?: {
		scripts?: Record<string, string>;
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		optionalDependencies?: Record<string, string>;
		peerDependencies?: Record<string, string>;
		engines?: { node?: string };
		packageManager?: string;
		devEngines?: {
			packageManager?:
				| string
				| {
						name?: string;
						version?: string;
						onFail?: string;
				  };
		};
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringRecord(value: unknown): Record<string, string> {
	if (!isRecord(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
	);
}

function readPackageJsonRaw(value: unknown): ParsedPackageJson['raw'] | undefined {
	if (!isRecord(value)) return undefined;
	const devEngines = isRecord(value.devEngines) ? value.devEngines : undefined;
	const packageManager = isRecord(devEngines?.packageManager)
		? {
				name:
					typeof devEngines.packageManager.name === 'string'
						? devEngines.packageManager.name
						: undefined,
				version:
					typeof devEngines.packageManager.version === 'string'
						? devEngines.packageManager.version
						: undefined,
				onFail:
					typeof devEngines.packageManager.onFail === 'string'
						? devEngines.packageManager.onFail
						: undefined
			}
		: typeof devEngines?.packageManager === 'string'
			? devEngines.packageManager
			: undefined;

	return {
		scripts: readStringRecord(value.scripts),
		dependencies: readStringRecord(value.dependencies),
		devDependencies: readStringRecord(value.devDependencies),
		optionalDependencies: readStringRecord(value.optionalDependencies),
		peerDependencies: readStringRecord(value.peerDependencies),
		engines: isRecord(value.engines)
			? { node: typeof value.engines.node === 'string' ? value.engines.node : undefined }
			: undefined,
		packageManager: typeof value.packageManager === 'string' ? value.packageManager : undefined,
		devEngines: packageManager === undefined ? undefined : { packageManager }
	};
}

export function parsePackageJson(text: string | null): ParsedPackageJson {
	if (!text) return { dependencies: {}, valid: false };
	try {
		const parsed = readPackageJsonRaw(JSON.parse(text));
		if (!parsed) return { dependencies: {}, valid: false };
		return {
			dependencies: Object.assign(
				{},
				parsed?.dependencies,
				parsed?.devDependencies,
				parsed?.optionalDependencies,
				parsed?.peerDependencies
			),
			raw: parsed,
			valid: true
		};
	} catch {
		return { dependencies: {}, valid: false };
	}
}

export type NpmLicenseFetcher = (pkg: string) => Promise<string | null>;

const MAX_DEP_LOOKUPS = 20;

/**
 * Audit production dependencies against the sell-rights database. Registry
 * lookups are budget-capped; curated entries need no lookup at all.
 */
export async function auditNpmDependencies(
	dependencies: Record<string, string>,
	fetchLicense: NpmLicenseFetcher
): Promise<{ libraries: DetectedLibrary[]; audited: number; total: number }> {
	const names = Object.keys(dependencies);
	const sample = names.slice(0, MAX_DEP_LOOKUPS);

	const libraries = await Promise.all(
		sample.map(async (name) => {
			const version = dependencies[name]?.replace(/^[\^~>=<]+/, '') || null;
			const curated = describeNpmDependency(name, version, null);
			// Curated hit (not 'unknown' fallback) — skip the registry round-trip.
			if (curated.category !== 'unknown') return curated;
			const license = await fetchLicense(name).catch(() => null);
			return describeNpmDependency(name, version, license);
		})
	);

	return { libraries, audited: sample.length, total: names.length };
}

export function npmRegistryLicenseFetcher(): NpmLicenseFetcher {
	return async (pkg: string) => {
		try {
			const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, {
				signal: AbortSignal.timeout(8000)
			});
			if (!res.ok) return null;
			const body: unknown = await res.json();
			if (!isRecord(body)) return null;
			if (typeof body.license === 'string') return body.license;
			if (isRecord(body.license) && typeof body.license.type === 'string') {
				return body.license.type;
			}
			return null;
		} catch {
			return null;
		}
	};
}
