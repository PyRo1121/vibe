import type { RepoRef } from '$lib/scan/repo/parse';
import type { RepoFetchers, RepoMeta, RepoTreeEntry } from '$lib/scan/repo/github';
import type { ScanCheck, ScanReport, RepoInfo } from '$lib/scan/types';
import { repoHtmlUrl } from '$lib/scan/repo/parse';
import { githubFetchers, RepoScanError } from '$lib/scan/repo/github';
import {
	findCommittedEnvFiles,
	selectSourceSamples,
	findRootFile,
	parsePackageJson,
	auditNpmDependencies,
	npmRegistryLicenseFetcher,
	MAX_DEP_LOOKUPS,
	type NpmLicenseFetcher
} from '$lib/scan/repo/audit';
import { parsePackageLock, screenTransitiveLicenses } from '$lib/scan/repo/lockfile';
import { auditVulnerabilities, type OsvAudit } from '$lib/scan/repo/osv';
import type { LockPackage } from '$lib/scan/repo/lockfile';
import {
	buildLicenseAudit,
	classifySpdx,
	licenseCheckStatus,
	mergeLibraries
} from '$lib/scan/license';
import { findSecrets } from '$lib/scan/parse';
import { visibleText } from '$lib/scan/signals';
import { makeCheck, buildReport } from '$lib/scan/score';
import { fixPrompt } from '$lib/scan/prompts';
import {
	findCiConfig,
	findLockfile,
	hasTests,
	nodeVersionPinned,
	parseTsconfigStrict
} from '$lib/scan/repo/quality';

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
	const packageJsonPath = findRootFile(entries, /^package\.json$/);
	const readmePath = findRootFile(entries, /^readme(\.(md|markdown|txt|rst))?$/i);
	const gitignorePath = findRootFile(entries, /^\.gitignore$/);
	const lockfilePath = findRootFile(entries, /^package-lock\.json$/);
	const tsconfigPath = findRootFile(entries, /^tsconfig\.json$/);

	const getFile = (path: string | null, maxBytes?: number) =>
		path ? fetchers.getFile(ref, meta.branch, path, maxBytes) : Promise.resolve(null);

	const [packageJsonText, readmeText, gitignoreText, lockfileText, tsconfigText, envTexts, sampleTexts] =
		await Promise.all([
			getFile(packageJsonPath),
			getFile(readmePath),
			getFile(gitignorePath),
			getFile(lockfilePath, MAX_LOCKFILE_BYTES),
			getFile(tsconfigPath),
			Promise.all(envFiles.slice(0, 2).map((p) => getFile(p))),
			Promise.all(sampleFiles.map((p) => getFile(p)))
		]);

	const { dependencies, valid: hasPackageJson } = parsePackageJson(packageJsonText);
	const lockPackages = parsePackageLock(lockfileText);
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
	) => checks.push(makeCheck(id, category, title, status, message, fixPrompt(id, { url, message })));

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
	sampleTexts.forEach((text) => {
		if (text) for (const label of findSecrets(text)) sourceSecrets.add(label);
	});
	check(
		'secrets',
		'security',
		'Secrets in source',
		sourceSecrets.size > 0 ? 'fail' : 'pass',
		sourceSecrets.size > 0
			? `Possible ${[...sourceSecrets].join(', ')} in sampled source files — move to env vars and rotate the keys.`
			: `No obvious secret patterns in ${sampleFiles.length} sampled source files.`
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
		check('gitignore-env', 'security', '.gitignore covers .env', 'pass', '.gitignore excludes .env files.');
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
			const extra =
				vulnAudit.findings.length > 3 ? ` +${vulnAudit.findings.length - 3} more` : '';
			const severe = vulnAudit.worstSeverity === 'critical' || vulnAudit.worstSeverity === 'high';
			check(
				'dependency-vulns',
				'security',
				'Known vulnerabilities (OSV)',
				severe ? 'fail' : 'warn',
				`${vulnAudit.findings.length} of ${vulnAudit.checked.toLocaleString()} lockfile dependencies have known vulnerabilities${
					vulnAudit.worstSeverity ? ` (worst: ${vulnAudit.worstSeverity})` : ''
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

	const testsFound = hasTests(entries, packageJsonText);
	check(
		'tests-present',
		'launch',
		'Tests present',
		testsFound ? 'pass' : 'warn',
		testsFound
			? 'Test files or a test script found — you can refactor and ship with more confidence.'
			: 'No tests found — you cannot safely accept AI-generated changes or refactor without manual QA every time.'
	);

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

	const nodePinned = nodeVersionPinned(entries, packageJsonText);
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

	const repo: RepoInfo = {
		owner: ref.owner,
		repo: ref.repo,
		branch: meta.branch,
		description: meta.description,
		stars: meta.stars,
		license: meta.licenseSpdx,
		filesSampled: [
			...new Set([
				...(packageJsonPath ? [packageJsonPath] : []),
				...(lockfilePath && lockPackages.length > 0 ? [lockfilePath] : []),
				...(readmePath ? [readmePath] : []),
				...(gitignorePath ? [gitignorePath] : []),
				...(tsconfigPath ? [tsconfigPath] : []),
				...(ciPath ? [ciPath] : []),
				...(committedLockfile && committedLockfile !== lockfilePath ? [committedLockfile] : []),
				...envFiles.slice(0, 2),
				...sampleFiles
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

/** Cap on npm registry lookups per scan — exported for UI copy and tests. */
export const REPO_DEP_LOOKUP_BUDGET = MAX_DEP_LOOKUPS;
