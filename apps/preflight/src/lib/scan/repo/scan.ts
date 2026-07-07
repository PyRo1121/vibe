import {
	buildLicenseAudit,
	classifySpdx,
	licenseCheckStatus,
	mergeLibraries
} from '$lib/scan/license';
import { findSecrets } from '$lib/scan/parse';
import { fixPrompt } from '$lib/scan/prompts';
import {
	findCommittedEnvFiles,
	selectSourceSamples,
	findRootFile,
	parsePackageJson,
	auditNpmDependencies,
	npmRegistryLicenseFetcher,
	type NpmLicenseFetcher
} from '$lib/scan/repo/audit';
import { mergeRepoFindings } from '$lib/scan/repo/findings';
import type { RepoFetchers, RepoMeta, RepoTreeEntry } from '$lib/scan/repo/github';
import { githubFetchers, RepoScanError } from '$lib/scan/repo/github';
import { parsePackageLock, screenTransitiveLicenses } from '$lib/scan/repo/lockfile';
import type { LockPackage } from '$lib/scan/repo/lockfile';
import { auditVulnerabilities, type OsvAudit } from '$lib/scan/repo/osv';
import type { RepoRef } from '$lib/scan/repo/parse';
import { repoHtmlUrl } from '$lib/scan/repo/parse';
import {
	assessTestSuiteDepth,
	findCiConfig,
	findLockfile,
	findTestFilePaths,
	hasTests,
	nodeVersionPinned,
	parseTsconfigStrict
} from '$lib/scan/repo/quality';
import {
	analyzeBillingReadiness,
	analyzeCiWorkflows,
	analyzeDeployConfig,
	analyzeLintSetup,
	analyzePackageManager,
	analyzePackageScripts,
	analyzeTypescriptSetup,
	type PackageManifestEvidence,
	type RepoFileEvidence,
	type RepoReadinessFinding
} from '$lib/scan/repo/readiness';
import { makeCheck, buildReport } from '$lib/scan/score';
import { visibleText } from '$lib/scan/signals';
import type { ScanCheck, ScanReport, RepoInfo } from '$lib/scan/types';

/**
 * Repository scan: audits a public GitHub repo pre-deploy — committed env
 * files, secret patterns in source, repo + dependency licenses (sell rights),
 * .gitignore hygiene, and README quality. Produces the same ScanReport shape
 * as a site scan so the whole report UI works unchanged.
 */

export interface RepoScanDeps {
	fetchers?: RepoFetchers;
	npmLicense?: NpmLicenseFetcher;
	/** Injectable OSV vulnerability auditor — defaults to the live OSV.dev API. */
	vulnAuditor?: (packages: LockPackage[]) => Promise<OsvAudit | null>;
}

/** Lockfiles routinely exceed the default file cap; allow up to 3MB. */
const MAX_LOCKFILE_BYTES = 3 * 1024 * 1024;

const README_MIN_WORDS = 60;
const MAX_PACKAGE_MANIFESTS = 5;
const MAX_PACKAGE_LOCKFILES = 3;
const STATIC_CONFIG_LIMIT = 48;
const PAYMENT_FILE_LIMIT = 16;

function isVendoredPath(path: string): boolean {
	return /(^|\/)(node_modules|dist|build|out|vendor|\.next|\.svelte-kit|coverage)\//.test(path);
}

function findPackageJsonPaths(entries: RepoTreeEntry[]): string[] {
	const paths = entries
		.filter(
			(e) => e.type === 'blob' && !isVendoredPath(e.path) && /(^|\/)package\.json$/.test(e.path)
		)
		.map((e) => e.path);
	return [
		...paths.filter((path) => path === 'package.json'),
		...paths.filter((path) => path !== 'package.json')
	].slice(0, MAX_PACKAGE_MANIFESTS);
}

function findPackageLockPaths(entries: RepoTreeEntry[]): string[] {
	const paths = entries
		.filter(
			(e) =>
				e.type === 'blob' && !isVendoredPath(e.path) && /(^|\/)package-lock\.json$/.test(e.path)
		)
		.map((e) => e.path);
	return [
		...paths.filter((path) => path === 'package-lock.json'),
		...paths.filter((path) => path !== 'package-lock.json')
	].slice(0, MAX_PACKAGE_LOCKFILES);
}

function findStaticConfigPaths(entries: RepoTreeEntry[]): string[] {
	const patterns = [
		/(^|\/)eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/,
		/(^|\/)\.eslintrc(\.(json|js|cjs|yml|yaml))?$/,
		/(^|\/)biome\.jsonc?$/,
		/(^|\/)\.prettierrc(\.(json|js|cjs|mjs|yml|yaml))?$/,
		/(^|\/)prettier\.config\.(js|cjs|mjs|ts)$/,
		/(^|\/)tsconfig\.json$/,
		/^\.github\/workflows\/[^/]+\.(ya?ml)$/,
		/^\.github\/dependabot\.ya?ml$/,
		/(^|\/)renovate\.json5?$/,
		/(^|\/)\.renovaterc(\.json)?$/,
		/(^|\/)wrangler\.(jsonc?|toml)$/,
		/(^|\/)vercel\.json$/,
		/(^|\/)netlify\.toml$/,
		/(^|\/)Dockerfile$/,
		/(^|\/)docker-compose\.ya?ml$/,
		/^package-lock\.json$/,
		/^npm-shrinkwrap\.json$/,
		/^pnpm-lock\.yaml$/,
		/^yarn\.lock$/,
		/^bun\.lockb?$/
	];

	return entries
		.filter((entry) => entry.type === 'blob' && !isVendoredPath(entry.path))
		.map((entry) => entry.path)
		.filter((path) => patterns.some((pattern) => pattern.test(path)))
		.slice(0, STATIC_CONFIG_LIMIT);
}

function findPaymentFilePaths(entries: RepoTreeEntry[]): string[] {
	const sourceExt = /\.(js|mjs|cjs|ts|mts|cts|jsx|tsx|svelte|py|rb|go|php)$/i;
	const pathToken =
		/(^|\/|\.|-|_)(checkout|billing|payments?|stripe|subscriptions?|entitlements?)(\/|\.|-|_|$)/i;
	const svelteKitPaymentRoute =
		/(^|\/)src\/routes\/(?:api\/(?:checkout|billing|payments?|stripe|subscriptions?|webhooks?\/(?:checkout|billing|payments?|stripe|subscriptions?))|account\/billing)(?:\/[^/]*)*\/\+server\.(js|ts)$/i;

	const candidates = entries
		.filter(
			(entry) =>
				entry.type === 'blob' &&
				sourceExt.test(entry.path) &&
				!isVendoredPath(entry.path) &&
				(pathToken.test(entry.path) || svelteKitPaymentRoute.test(entry.path))
		)
		.map((entry) => entry.path);

	const score = (path: string): number => {
		const lower = path.toLowerCase();
		const depth = path.split('/').length;
		return (
			(svelteKitPaymentRoute.test(path) ? 0 : 50) +
			(lower.includes('webhook') ? 0 : 10) +
			(lower.includes('checkout') ? 0 : 5) +
			(lower.includes('entitlement') ? 0 : 3) +
			depth
		);
	};

	return [...new Set(candidates)]
		.toSorted((a, b) => score(a) - score(b))
		.slice(0, PAYMENT_FILE_LIMIT);
}

function manifestEvidence(paths: string[], texts: (string | null)[]): PackageManifestEvidence[] {
	return paths.flatMap((path, index) => {
		const parsed = parsePackageJson(texts[index]);
		return parsed.valid && parsed.raw ? [{ path, json: parsed.raw }] : [];
	});
}

function repoReadinessChecks(url: string, findings: RepoReadinessFinding[]): ScanCheck[] {
	return mergeRepoFindings(findings).map((item) =>
		makeCheck(
			item.id,
			item.category,
			item.title,
			item.status,
			item.message,
			fixPrompt(item.id, {
				url,
				message: item.message
			})
		)
	);
}

function uniqueLockPackages(packages: LockPackage[]): LockPackage[] {
	const seen = new Map<string, LockPackage>();
	for (const pkg of packages) {
		const key = `${pkg.name}@${pkg.version}`;
		if (!seen.has(key)) seen.set(key, pkg);
	}
	return [...seen.values()];
}

export async function scanRepo(
	ref: RepoRef,
	opts: { token?: string } & RepoScanDeps = {}
): Promise<ScanReport> {
	const url = repoHtmlUrl(ref);
	const fetchers = opts.fetchers ?? githubFetchers(opts.token);
	const npmLicense = opts.npmLicense ?? npmRegistryLicenseFetcher();
	const vulnAuditor = opts.vulnAuditor ?? auditVulnerabilities;

	let meta: RepoMeta;
	let entries: RepoTreeEntry[];
	try {
		meta = await fetchers.getMeta(ref);
		({ entries } = await fetchers.getTree(ref, meta.branch));
	} catch (err) {
		const reason = err instanceof RepoScanError ? err.message : 'GitHub could not be reached.';
		return buildBlockedRepoReport(url, reason);
	}

	const envFiles = findCommittedEnvFiles(entries);
	const sampleFiles = selectSourceSamples(entries);
	const packageJsonPaths = findPackageJsonPaths(entries);
	const packageJsonPath = packageJsonPaths.find((path) => path === 'package.json') ?? null;
	const readmePath = findRootFile(entries, /^readme(\.(md|markdown|txt|rst))?$/i);
	const gitignorePath = findRootFile(entries, /^\.gitignore$/);
	const lockfilePaths = findPackageLockPaths(entries);
	const tsconfigPath = findRootFile(entries, /^tsconfig\.json$/);
	const staticConfigPaths = findStaticConfigPaths(entries);
	const fetchedSourcePaths = new Set([...sampleFiles, ...staticConfigPaths]);
	const paymentFilePaths = findPaymentFilePaths(entries).filter(
		(path) => !fetchedSourcePaths.has(path)
	);
	const allTestFilePaths = findTestFilePaths(entries);
	const extraTestFilePaths = allTestFilePaths.filter(
		(path) => !fetchedSourcePaths.has(path) && !paymentFilePaths.includes(path)
	);

	const getFile = (path: string | null, maxBytes?: number) =>
		path ? fetchers.getFile(ref, meta.branch, path, maxBytes) : Promise.resolve(null);

	const [
		packageJsonTexts,
		readmeText,
		gitignoreText,
		lockfileTexts,
		tsconfigText,
		envTexts,
		sampleTexts,
		staticConfigTexts,
		paymentFileTexts,
		extraTestFileTexts
	] = await Promise.all([
		Promise.all(packageJsonPaths.map((path) => getFile(path))),
		getFile(readmePath),
		getFile(gitignorePath),
		Promise.all(lockfilePaths.map((path) => getFile(path, MAX_LOCKFILE_BYTES))),
		getFile(tsconfigPath),
		Promise.all(envFiles.slice(0, 2).map((p) => getFile(p))),
		Promise.all(sampleFiles.map((p) => getFile(p))),
		Promise.all(staticConfigPaths.map((path) => getFile(path, MAX_LOCKFILE_BYTES))),
		Promise.all(paymentFilePaths.map((path) => getFile(path))),
		Promise.all(extraTestFilePaths.map((path) => getFile(path)))
	]);

	const parsedManifests = packageJsonTexts.map((text) => parsePackageJson(text));
	const packageEvidence = manifestEvidence(packageJsonPaths, packageJsonTexts);
	const staticFiles: RepoFileEvidence[] = staticConfigPaths.map((path, index) => ({
		path,
		text: staticConfigTexts[index] ?? null
	}));
	const sourceFiles: RepoFileEvidence[] = sampleFiles.map((path, index) => ({
		path,
		text: sampleTexts[index] ?? null
	}));
	const paymentFiles: RepoFileEvidence[] = paymentFilePaths.map((path, index) => ({
		path,
		text: paymentFileTexts[index] ?? null
	}));
	const extraTestFiles: RepoFileEvidence[] = extraTestFilePaths.map((path, index) => ({
		path,
		text: extraTestFileTexts[index] ?? null
	}));
	const fetchedTextByPath = new Map(
		[...staticFiles, ...sourceFiles, ...paymentFiles, ...extraTestFiles].map((file) => [
			file.path,
			file.text
		])
	);
	const testFiles: RepoFileEvidence[] = allTestFilePaths.map((path) => ({
		path,
		text: fetchedTextByPath.get(path) ?? null
	}));
	const repoFiles = [
		...new Map(
			[...staticFiles, ...sourceFiles, ...paymentFiles].map((file) => [file.path, file])
		).values()
	];
	const rootPackageJsonText =
		packageJsonPath == null
			? null
			: (packageJsonTexts[packageJsonPaths.indexOf(packageJsonPath)] ?? null);
	const dependencies = Object.assign(
		{},
		...parsedManifests.map((parsed) => parsed.dependencies)
	) as Record<string, string>;
	const hasPackageJson = parsedManifests.some((parsed) => parsed.valid);
	const lockPackages = uniqueLockPackages(lockfileTexts.flatMap((text) => parsePackageLock(text)));
	const [depAudit, vulnAudit] = await Promise.all([
		hasPackageJson ? auditNpmDependencies(dependencies, npmLicense) : Promise.resolve(null),
		lockPackages.length > 0 ? vulnAuditor(lockPackages) : Promise.resolve(null)
	]);
	const transitiveFlagged = screenTransitiveLicenses(lockPackages);
	const licenseAudit = depAudit
		? buildLicenseAudit(mergeLibraries(depAudit.libraries, transitiveFlagged))
		: transitiveFlagged.length > 0
			? buildLicenseAudit(transitiveFlagged)
			: undefined;

	const checks: ScanCheck[] = [];
	const check = (
		id: string,
		category: ScanCheck['category'],
		title: string,
		status: ScanCheck['status'],
		message: string
	) =>
		checks.push(makeCheck(id, category, title, status, message, fixPrompt(id, { url, message })));

	// --- Committed env files (P0) ---
	if (envFiles.length > 0) {
		const shown = envFiles.slice(0, 3).join(', ');
		const extra = envFiles.length > 3 ? ` (+${envFiles.length - 3} more)` : '';
		const envSecrets = [...new Set(envTexts.flatMap((text) => (text ? findSecrets(text) : [])))];
		// .env/.env.local/.env.production hold real credentials; .env.dev-style
		// files with no detected secrets are a hygiene warning, not a blocker.
		const critical = envFiles.some((path) =>
			/^\.env(\.(local|production|prod))?$/.test(path.split('/').pop() ?? '')
		);
		const status = envSecrets.length > 0 || critical ? 'fail' : 'warn';
		const secretNote =
			envSecrets.length > 0 ? ` — live secret patterns inside: ${envSecrets.join(', ')}` : '';
		check(
			'env-committed',
			'security',
			'Committed .env files',
			status,
			`Environment file committed to the repo: ${shown}${extra}${secretNote}. Anyone who clones this repo gets these values.`
		);
	} else {
		check('env-committed', 'security', 'Committed .env files', 'pass', 'No .env files committed.');
	}

	// --- Secret patterns in sampled source (P0) ---
	const sourceSecrets = new Set<string>();
	const sourceSecretTexts = [...sampleTexts, ...paymentFileTexts];
	sourceSecretTexts.forEach((text) => {
		if (text) for (const label of findSecrets(text)) sourceSecrets.add(label);
	});
	check(
		'secrets',
		'security',
		'Secrets in source',
		sourceSecrets.size > 0 ? 'fail' : 'pass',
		sourceSecrets.size > 0
			? `Possible ${[...sourceSecrets].join(', ')} in sampled source files — move to env vars and rotate the keys.`
			: `No obvious secret patterns in ${sourceSecretTexts.length} sampled source files.`
	);

	// --- .gitignore hygiene (P1) ---
	if (!gitignorePath) {
		check(
			'gitignore-env',
			'security',
			'.gitignore covers .env',
			'warn',
			'No .gitignore found — env files and build output can be committed by accident.'
		);
	} else if (gitignoreText && /(^|\n)\s*\*?\.env/.test(gitignoreText)) {
		check(
			'gitignore-env',
			'security',
			'.gitignore covers .env',
			'pass',
			'.gitignore excludes .env files.'
		);
	} else {
		check(
			'gitignore-env',
			'security',
			'.gitignore covers .env',
			'warn',
			'.gitignore does not exclude .env — one accidental commit exposes every secret.'
		);
	}

	// --- Known vulnerabilities via OSV.dev (P0) — needs a lockfile ---
	if (lockPackages.length > 0 && vulnAudit) {
		if (vulnAudit.findings.length === 0) {
			check(
				'dependency-vulns',
				'security',
				'Known vulnerabilities (OSV)',
				'pass',
				`No known vulnerabilities across ${vulnAudit.checked.toLocaleString()} lockfile dependencies (OSV.dev).`
			);
		} else {
			const shown = vulnAudit.findings
				.slice(0, 3)
				.map((f) => `${f.package}@${f.version} (${f.vulnIds[0]})`)
				.join(', ');
			const extra = vulnAudit.findings.length > 3 ? ` +${vulnAudit.findings.length - 3} more` : '';
			const severe = vulnAudit.worstSeverity === 'critical' || vulnAudit.worstSeverity === 'high';
			const severityNote = vulnAudit.worstSeverity
				? ` (worst: ${vulnAudit.worstSeverity})`
				: ' (severity unavailable)';
			check(
				'dependency-vulns',
				'security',
				'Known vulnerabilities (OSV)',
				severe ? 'fail' : 'warn',
				`${vulnAudit.findings.length} of ${vulnAudit.checked.toLocaleString()} lockfile dependencies have known vulnerabilities${
					severityNote
				}: ${shown}${extra}. Run npm audit fix, or bump the affected packages.`
			);
		}
	}

	// --- Repo license & sell rights (P1) ---
	checks.push(repoLicenseCheck(url, meta.licenseSpdx));

	// --- Dependency licenses (P1) — only when a package.json exists ---
	if (depAudit && licenseAudit) {
		const coverage =
			depAudit.total > depAudit.audited
				? ` Audited the first ${depAudit.audited} of ${depAudit.total} direct dependencies.`
				: '';
		const transitive =
			lockPackages.length > 0
				? ` Screened ${lockPackages.length.toLocaleString()} lockfile packages for copyleft/non-commercial licenses${
						transitiveFlagged.length > 0 ? ` — ${transitiveFlagged.length} flagged` : ''
					}.`
				: '';
		check(
			'license-risk',
			'legal',
			'Dependency licenses',
			licenseCheckStatus(licenseAudit),
			`${licenseAudit.summary}${coverage}${transitive}`
		);
	}

	// --- README (P2) ---
	if (!readmePath || !readmeText) {
		check(
			'readme',
			'launch',
			'README',
			'warn',
			'No README found — users and collaborators land on a bare file tree.'
		);
	} else {
		const words = visibleText(readmeText).split(/\s+/).filter(Boolean).length;
		check(
			'readme',
			'launch',
			'README',
			words >= README_MIN_WORDS ? 'pass' : 'warn',
			words >= README_MIN_WORDS
				? `README present — ${words.toLocaleString()} words.`
				: `README is a stub (${words} words) — explain what the project does, how to run it, and how to deploy.`
		);
	}

	// --- Repo quality (P2) ---
	const ciPath = findCiConfig(entries);
	check(
		'ci-config',
		'launch',
		'CI configured',
		ciPath ? 'pass' : 'warn',
		ciPath
			? `CI workflow found (${ciPath}) — pushes get tested before deploy.`
			: 'No CI workflow found — every deploy is a manual gamble, especially when accepting AI-generated changes.'
	);

	const testsFound = hasTests(entries, rootPackageJsonText);
	check(
		'tests-present',
		'launch',
		'Tests present',
		testsFound ? 'pass' : 'warn',
		testsFound
			? 'Test files or a test script found — you can refactor and ship with more confidence.'
			: 'No tests found — you cannot safely accept AI-generated changes or refactor without manual QA every time.'
	);

	const testDepth = assessTestSuiteDepth(entries, rootPackageJsonText, testFiles, staticFiles);
	check('test-depth', 'launch', 'Test suite depth', testDepth.status, testDepth.message);

	const committedLockfile = findLockfile(entries);
	check(
		'lockfile-committed',
		'launch',
		'Lockfile committed',
		committedLockfile ? 'pass' : 'warn',
		committedLockfile
			? `Lockfile committed (${committedLockfile}) — installs are reproducible.`
			: 'No lockfile committed — every install may resolve different dependency versions than you shipped.'
	);

	const nodePinned = nodeVersionPinned(entries, rootPackageJsonText);
	check(
		'node-version-pinned',
		'launch',
		'Node version pinned',
		nodePinned ? 'pass' : 'warn',
		nodePinned
			? 'Node version pinned via engines.node, .nvmrc, or .node-version.'
			: 'Node version not pinned — deploys and collaborators may hit mysterious runtime errors on version mismatch.'
	);

	if (tsconfigPath) {
		const tsconfig = parseTsconfigStrict(tsconfigText);
		if (tsconfig.valid) {
			check(
				'ts-strict',
				'launch',
				'TypeScript strict mode',
				tsconfig.strict ? 'pass' : 'warn',
				tsconfig.strict
					? 'tsconfig.json has strict: true — null/undefined bugs get caught at compile time.'
					: 'tsconfig.json exists but strict mode is off — TypeScript will miss the null/undefined bugs it exists to catch.'
			);
		}
	}

	const readinessFindings = [
		...(packageEvidence.length > 0
			? [
					...analyzePackageScripts(packageEvidence),
					...analyzeLintSetup(packageEvidence, staticFiles),
					...analyzePackageManager(packageEvidence, staticFiles)
				]
			: []),
		...analyzeTypescriptSetup(packageEvidence, staticFiles),
		...analyzeCiWorkflows(staticFiles),
		...analyzeBillingReadiness(packageEvidence, repoFiles),
		...analyzeDeployConfig(packageEvidence, staticFiles)
	];
	checks.push(...repoReadinessChecks(url, readinessFindings));

	const repo: RepoInfo = {
		owner: ref.owner,
		repo: ref.repo,
		branch: meta.branch,
		description: meta.description,
		stars: meta.stars,
		license: meta.licenseSpdx,
		filesSampled: [
			...new Set([
				...packageJsonPaths,
				...(lockPackages.length > 0 ? lockfilePaths : []),
				...(readmePath ? [readmePath] : []),
				...(gitignorePath ? [gitignorePath] : []),
				...(tsconfigPath ? [tsconfigPath] : []),
				...(ciPath ? [ciPath] : []),
				...staticConfigPaths,
				...(committedLockfile && !lockfilePaths.includes(committedLockfile)
					? [committedLockfile]
					: []),
				...envFiles.slice(0, 2),
				...sampleFiles,
				...paymentFilePaths,
				...testDepth.sampledPaths
			])
		],
		depCount: hasPackageJson ? Object.keys(dependencies).length : null
	};

	return buildReport(url, new URL(url), checks, undefined, { licenseAudit, repo });
}

function repoLicenseCheck(url: string, spdx: string | null): ScanCheck {
	const make = (status: ScanCheck['status'], message: string): ScanCheck => ({
		id: 'repo-license',
		category: 'legal',
		title: 'Repo license & sell rights',
		status,
		message,
		fixPrompt: fixPrompt('repo-license', { url, message })
	});

	if (!spdx) {
		return make(
			'warn',
			'No LICENSE file — the code is all-rights-reserved by default. Fine for a private product; add a license before accepting contributions or letting others use the code.'
		);
	}
	if (spdx === 'NOASSERTION') {
		return make(
			'warn',
			'A license file exists but GitHub cannot identify it — read it before building a commercial product on this code.'
		);
	}

	const { sellable, note } = classifySpdx(spdx);
	// Family notes start with e.g. "AGPL — "; drop it so "AGPL-3.0 — AGPL — …" never renders.
	const detail = note.replace(/^[A-Za-z ]+ — /, '');
	if (sellable === 'yes') {
		return make('pass', `${spdx} — you can sell products built on this code. ${detail}`);
	}
	if (sellable === 'risk') {
		return make('fail', `${spdx} — ${detail}`);
	}
	if (sellable === 'conditions') {
		return make('warn', `${spdx} — sellable with conditions. ${detail}`);
	}
	return make(
		'warn',
		`${spdx} — not in our license database. Confirm commercial use is allowed before selling.`
	);
}

/** GitHub unreachable / repo missing → honest blocked report, same as a blocked site scan. */
function buildBlockedRepoReport(url: string, reason: string): ScanReport {
	const message = `Scan incomplete — ${reason}`;
	const checks: ScanCheck[] = [
		{
			id: 'fetch',
			category: 'launch',
			title: 'Repository reachable',
			status: 'fail',
			message: reason,
			fixPrompt: fixPrompt('fetch', { url, message: reason })
		}
	];
	return buildReport(url, new URL(url), checks, undefined, {
		scanCoverage: 'blocked',
		blockedMessage: message
	});
}
