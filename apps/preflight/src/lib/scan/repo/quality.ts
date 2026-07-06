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

const TEST_FILE_PATTERNS = [
	/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|svelte)$/i,
	/(^|\/)(test_[^/]+|[^/]+_test)\.py$/i,
	/(^|\/)[^/]+_test\.go$/i,
	/(^|\/)[^/]+_spec\.rb$/i,
	/(^|\/)[^/]+Test\.php$/i,
	/(^|\/)(tests?\/[^/]+|[^/]+_test)\.rs$/i,
	/(^|\/)[^/]+Tests?\.cs$/i
];
const TEST_SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|svelte|py|go|rs|rb|php|cs)$/i;
const TEST_DIR = /(^|\/)(__tests__|tests?)\//;
const TEST_RUNNER =
	/\b(vitest|jest|mocha|ava|tap|uvu|playwright|cypress|web-test-runner|react-scripts\s+test|ng\s+test|node\s+--test|bun\s+test|deno\s+test|pytest|go\s+test|cargo\s+test|rspec|phpunit|dotnet\s+test)\b/i;
const TEST_ORCHESTRATOR =
	/\b(turbo|nx|lerna)\s+(?:run\s+)?test\b|\bpnpm\s+(?:-r|--recursive)\s+(?:run\s+)?test\b|\byarn\s+workspaces\b.*\btest\b|\b(make|just)\s+test\b/i;
const SCRIPT_DELEGATION = /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([a-z0-9:_-]*test[a-z0-9:_-]*)\b/gi;
const COVERAGE_SIGNAL =
	/\b(coverage|vitest\s+run\s+--coverage|jest\s+--coverage|nyc|c8|pytest\s+.*--cov|go\s+test\s+.*-cover|cargo\s+tarpaulin|coverageThreshold)\b/i;
const ASSERTION_SIGNAL =
	/\b(expect|assert|strictEqual|deepStrictEqual|toBe|toEqual|toContain|toHave|should|t\.(?:is|truthy|deepEqual)|cy\.(?:contains|get|request|url|location)|screen\.|userEvent\.|fireEvent\.|render\(|supertest|request\(|page\.(?:goto|getBy|locator|request)|testing-library)\b/i;
const TEST_CASE_SIGNAL =
	/\b(describe|it|test|suite|context|specify)\s*\(|\bdef\s+test_|\bfunc\s+Test[A-Z_]|#\[test\]|\bpublic\s+function\s+test/i;
const TRIVIAL_ASSERTION =
	/\b(expect\s*\(\s*(?:true|false|1|0|'ok'|"ok")\s*\)\s*\.\s*(?:toBe|toEqual|toStrictEqual|toBeTruthy|toBeFalsy)\s*\(\s*(?:true|false|1|0|'ok'|"ok")?\s*\)|assert(?:\.ok)?\s*\(\s*(?:true|1)\s*\)|t\.pass\s*\(\s*\))/i;

export interface RepoTestFileEvidence {
	path: string;
	text: string | null;
}

export interface TestSuiteDepthAudit {
	status: 'pass' | 'warn';
	message: string;
	sampledPaths: string[];
}

function isIgnoredPath(path: string): boolean {
	return /(^|\/)(node_modules|dist|build|out|vendor|\.next|\.svelte-kit|coverage)\//.test(path);
}

function isTestPath(path: string): boolean {
	if (TEST_FILE_PATTERNS.some((pattern) => pattern.test(path))) return true;
	return TEST_DIR.test(path) && TEST_SOURCE_FILE.test(path);
}

function testPathScore(path: string): number {
	const lower = path.toLowerCase();
	return (
		(/(e2e|playwright|cypress|integration|contract|api|webhook|billing|payment|auth|security)/.test(
			lower
		)
			? 0
			: 20) + path.split('/').length
	);
}

function parseScripts(packageJsonText: string | null): Record<string, string> {
	if (!packageJsonText) return {};
	try {
		const parsed = JSON.parse(packageJsonText) as { scripts?: Record<string, string> };
		return parsed.scripts ?? {};
	} catch {
		return {};
	}
}

function scriptText(scripts: Record<string, string>): string {
	return Object.entries(scripts)
		.map(([name, value]) => `${name}: ${value}`)
		.join('\n');
}

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
		if (!isIgnoredPath(entry.path) && isTestPath(entry.path)) return true;
	}
	return scriptRunsTests(parseScripts(packageJsonText), 'test');
}

function scriptRunsTests(
	scripts: Record<string, string>,
	scriptName: string,
	seen = new Set<string>()
): boolean {
	if (seen.has(scriptName)) return false;
	seen.add(scriptName);

	const script = scripts[scriptName]?.trim();
	if (!script) return false;
	if (/--passWithNoTests\b/i.test(script)) return false;
	if (TEST_RUNNER.test(script) || TEST_ORCHESTRATOR.test(script)) return true;

	for (const match of script.matchAll(SCRIPT_DELEGATION)) {
		if (scriptRunsTests(scripts, match[1], seen)) return true;
	}

	return false;
}

function hasCoverageSignal(
	scripts: Record<string, string>,
	files: RepoTestFileEvidence[] = []
): boolean {
	if (COVERAGE_SIGNAL.test(scriptText(scripts))) return true;
	return files.some((file) => COVERAGE_SIGNAL.test(file.text ?? ''));
}

function hasMeaningfulAssertions(text: string | null): boolean {
	if (!text) return false;
	const compact = text.replace(/\s+/g, ' ').trim();
	if (compact.length < 80) return false;
	if (!TEST_CASE_SIGNAL.test(text) && !ASSERTION_SIGNAL.test(text)) return false;
	if (TRIVIAL_ASSERTION.test(text) && compact.length < 220) return false;
	return ASSERTION_SIGNAL.test(text);
}

function testBreadth(paths: string[], scripts: Record<string, string>): string[] {
	const haystack = `${paths.join('\n')}\n${scriptText(scripts)}`.toLowerCase();
	const breadth = new Set<string>();
	if (
		/\b(unit|vitest|jest|node --test|pytest|go test|cargo test|rspec|phpunit|dotnet test)\b/.test(
			haystack
		)
	) {
		breadth.add('unit');
	}
	if (/\b(integration|contract|api|request|supertest)\b/.test(haystack)) {
		breadth.add('integration');
	}
	if (/\b(e2e|playwright|cypress|smoke)\b/.test(haystack)) {
		breadth.add('e2e');
	}
	return [...breadth];
}

/** Bounded test-file sampler used by repo scans to judge substance, not just presence. */
export function findTestFilePaths(entries: RepoTreeEntry[], limit = 12): string[] {
	return entries
		.filter(
			(entry) => entry.type === 'blob' && !isIgnoredPath(entry.path) && isTestPath(entry.path)
		)
		.map((entry) => entry.path)
		.toSorted((a, b) => testPathScore(a) - testPathScore(b) || a.localeCompare(b))
		.slice(0, limit);
}

export function assessTestSuiteDepth(
	entries: RepoTreeEntry[],
	packageJsonText: string | null,
	testFiles: RepoTestFileEvidence[],
	configFiles: RepoTestFileEvidence[] = []
): TestSuiteDepthAudit {
	const scripts = parseScripts(packageJsonText);
	const paths = findTestFilePaths(entries, 100);
	const hasRunnableTestScript = scriptRunsTests(scripts, 'test');
	const fetched = testFiles.filter((file) => file.text != null);
	const meaningful = fetched.filter((file) => hasMeaningfulAssertions(file.text));
	const coverage = hasCoverageSignal(scripts, configFiles);
	const breadth = testBreadth(paths, scripts);
	const sampledPaths = testFiles.map((file) => file.path);

	if (!hasRunnableTestScript && paths.length === 0) {
		return {
			status: 'warn',
			message: 'No runnable test command or test files were found in the scanned repository.',
			sampledPaths
		};
	}

	const strengths = [
		hasRunnableTestScript ? 'runnable test command' : null,
		meaningful.length > 0 ? `${meaningful.length} sampled test file(s) with real assertions` : null,
		coverage ? 'coverage signal' : null,
		breadth.length > 0 ? `${breadth.join('/')} coverage` : null
	].filter((item): item is string => Boolean(item));
	const gaps = [
		meaningful.length === 0 ? 'no sampled test file showed substantive assertions' : null,
		coverage ? null : 'no coverage command or threshold was visible',
		breadth.length >= 2 ? null : 'limited test breadth visible from paths and scripts',
		hasRunnableTestScript ? null : 'no runnable root test command was visible'
	].filter((item): item is string => Boolean(item));
	const score =
		(hasRunnableTestScript ? 1 : 0) +
		(meaningful.length >= 2 ? 2 : meaningful.length === 1 ? 1 : 0) +
		(coverage ? 1 : 0) +
		(breadth.length >= 2 ? 1 : 0) +
		(paths.length >= 4 ? 1 : 0);

	if (score >= 4) {
		return {
			status: 'pass',
			message: `Test suite has ${paths.length} discovered test file(s): ${strengths.join(', ')}.`,
			sampledPaths
		};
	}

	return {
		status: 'warn',
		message: `Test signal is shallow despite ${paths.length} discovered test file(s): ${gaps.join('; ')}.`,
		sampledPaths
	};
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

export function parseTsconfigStrict(text: string | null): {
	valid: boolean;
	strict: boolean | null;
} {
	if (!text) return { valid: false, strict: null };
	try {
		const parsed = JSON.parse(text) as { compilerOptions?: { strict?: boolean } };
		const strict = parsed.compilerOptions?.strict;
		return { valid: true, strict: strict === true };
	} catch {
		return { valid: false, strict: null };
	}
}
