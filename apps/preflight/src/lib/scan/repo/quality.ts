import type { RepoTreeEntry } from '$lib/scan/repo/github';

/** Pure repo-quality helpers — no network, fully unit-testable. */

const CI_PATTERNS = [
	/^\.github\/workflows\/[^/]+\.(ya?ml)$/,
	/^\.gitlab-ci\.ya?ml$/,
	/^\.circleci\/config\.ya?ml$/,
	/^azure-pipelines\.ya?ml$/,
	/^Jenkinsfile$/,
	/^\.travis\.ya?ml$/,
	/^bitbucket-pipelines\.ya?ml$/
];

const LOCKFILE_PATTERNS = [
	/^package-lock\.json$/,
	/^pnpm-lock\.yaml$/,
	/^yarn\.lock$/,
	/^bun\.lockb$/
];

const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const TEST_DIR = /(^|\/)(__tests__|tests?)\//;

/** First CI workflow or pipeline config in the tree. */
export function findCiConfig(entries: RepoTreeEntry[]): string | null {
	for (const entry of entries) {
		if (entry.type !== 'blob') continue;
		if (CI_PATTERNS.some((re) => re.test(entry.path))) return entry.path;
	}
	return null;
}

/** True when test files exist or package.json defines a non-trivial test script. */
export function hasTests(entries: RepoTreeEntry[], packageJsonText: string | null): boolean {
	for (const entry of entries) {
		if (entry.type !== 'blob') continue;
		if (TEST_FILE.test(entry.path) || TEST_DIR.test(entry.path)) return true;
	}
	if (!packageJsonText) return false;
	try {
		const parsed = JSON.parse(packageJsonText) as { scripts?: Record<string, string> };
		const script = parsed.scripts?.test?.trim();
		if (!script) return false;
		return !/^(echo\s+['"]?no tests|exit\s+0|true)\b/i.test(script);
	} catch {
		return false;
	}
}

/** Root lockfile path, if any. */
export function findLockfile(entries: RepoTreeEntry[]): string | null {
	for (const entry of entries) {
		if (entry.type !== 'blob' || entry.path.includes('/')) continue;
		if (LOCKFILE_PATTERNS.some((re) => re.test(entry.path))) return entry.path;
	}
	return null;
}

/** True when Node is pinned via engines.node, .nvmrc, or .node-version at repo root. */
export function nodeVersionPinned(
	entries: RepoTreeEntry[],
	packageJsonText: string | null
): boolean {
	const hasNvmrc = entries.some(
		(e) => e.type === 'blob' && (e.path === '.nvmrc' || e.path === '.node-version')
	);
	if (hasNvmrc) return true;
	if (!packageJsonText) return false;
	try {
		const parsed = JSON.parse(packageJsonText) as { engines?: { node?: string } };
		const node = parsed.engines?.node?.trim();
		return Boolean(node);
	} catch {
		return false;
	}
}

export function parseTsconfigStrict(text: string | null): { valid: boolean; strict: boolean | null } {
	if (!text) return { valid: false, strict: null };
	try {
		const parsed = JSON.parse(text) as { compilerOptions?: { strict?: boolean } };
		const strict = parsed.compilerOptions?.strict;
		return { valid: true, strict: strict === true };
	} catch {
		return { valid: false, strict: null };
	}
}
