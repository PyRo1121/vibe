#!/usr/bin/env node
/**
 * Draft Keep a Changelog bullets from conventional commits since the last deploylint tag.
 *
 * Usage:
 *   node scripts/changelog-draft.mjs
 *   node scripts/changelog-draft.mjs --since deploylint-v0.34.0
 *   node scripts/changelog-draft.mjs --include-chore
 *
 * Paste output into CHANGELOG.md [Unreleased] and edit for user-facing tone.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const currentDir = import.meta.dirname;
const ROOT = join(currentDir, '..');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');

const SKIP_TYPES = new Set(['chore', 'ci', 'test', 'build', 'style', 'revert']);
const TYPE_TO_SECTION = {
	feat: 'Added',
	fix: 'Fixed',
	perf: 'Changed',
	refactor: 'Changed',
	change: 'Changed',
	docs: 'Changed',
	security: 'Security',
	deprecate: 'Deprecated',
	remove: 'Removed'
};

const args = process.argv.slice(2);
const includeChore = args.includes('--include-chore');
const sinceIdx = args.indexOf('--since');
const sinceArg = sinceIdx >= 0 ? args[sinceIdx + 1] : null;

function run(cmd, { quiet = false } = {}) {
	return execSync(cmd, {
		cwd: join(ROOT, '../..'),
		encoding: 'utf8',
		stdio: quiet ? ['pipe', 'pipe', 'ignore'] : 'pipe'
	}).trim();
}

function latestDeploylintTag() {
	try {
		const tags = run('git tag -l "deploylint-v*" --sort=-v:refname');
		return tags.split('\n').filter(Boolean)[0] ?? null;
	} catch {
		return null;
	}
}

function latestReleasedVersion() {
	try {
		const text = readFileSync(CHANGELOG, 'utf8');
		const matches = [...text.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)];
		return matches[0]?.[1] ?? null;
	} catch {
		return null;
	}
}

function resolveSinceRef() {
	if (sinceArg) {
		if (gitRevParse(sinceArg)) return { ref: sinceArg, label: sinceArg };
		console.error(`warning: --since ${sinceArg} is not a valid git ref`);
	}

	const tag = latestDeploylintTag();
	if (tag && gitRevParse(tag)) return { ref: tag, label: tag };

	const ver = latestReleasedVersion();
	if (ver) {
		const tagName = `deploylint-v${ver}`;
		if (gitRevParse(tagName)) return { ref: tagName, label: tagName };
		const commit = changelogVersionCommit(ver);
		if (commit) return { ref: commit, label: `CHANGELOG [${ver}]` };
	}

	return { ref: null, label: 'repo start' };
}

function gitRevParse(ref) {
	try {
		run(`git rev-parse --verify --quiet ${ref}^{commit}`, { quiet: true });
		return true;
	} catch {
		return false;
	}
}

function changelogVersionCommit(version) {
	try {
		const hash = run(`git log -1 --format=%H -S "## [${version}]" -- apps/preflight/CHANGELOG.md`, {
			quiet: true
		});
		return hash || null;
	} catch {
		return null;
	}
}

function parseSubject(line) {
	// conventional: type(scope)!: subject  OR  type!: subject  OR  type: subject
	const m = line.match(
		/^(feat|fix|perf|refactor|change|docs|chore|ci|test|build|style|security|deprecate|remove)(\([^)]+\))?!?:\s*(.+)$/i
	);
	if (!m) return null;
	return {
		type: m[1].toLowerCase(),
		breaking: line.includes('!:'),
		subject: m[3].trim()
	};
}

function formatBullet(parsed) {
	let text = parsed.subject;
	if (parsed.breaking) text = `**Breaking:** ${text}`;
	return `- ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function collectCommits(ref) {
	const range = ref ? `${ref}..HEAD` : 'HEAD';
	let raw;
	try {
		raw = run(
			`git log ${range} --pretty=format:%s --no-merges -- apps/preflight docs/superpowers .github/workflows/preflight-gate.yml`
		);
	} catch {
		raw = '';
	}
	if (!raw) return [];
	return raw.split('\n').filter(Boolean);
}

const { ref: sinceRef, label: sinceLabel } = resolveSinceRef();
const subjects = collectCommits(sinceRef);
const grouped = new Map();

for (const line of subjects) {
	const parsed = parseSubject(line);
	if (!parsed) continue;
	if (!includeChore && SKIP_TYPES.has(parsed.type)) continue;
	const section = TYPE_TO_SECTION[parsed.type] ?? 'Changed';
	if (!grouped.has(section)) grouped.set(section, []);
	grouped.get(section).push(formatBullet(parsed));
}

const order = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
const lines = [];

lines.push(`# Changelog draft (since ${sinceLabel})`, '');
lines.push('Paste into CHANGELOG.md [Unreleased] and rewrite for users.', '');

if (grouped.size === 0) {
	lines.push('_No conventional commits in scope. Use manual bullets or widen --since._');
} else {
	for (const section of order) {
		const bullets = grouped.get(section);
		if (!bullets?.length) continue;
		lines.push(`### ${section}`, '');
		for (const b of bullets) lines.push(b);
		lines.push('');
	}
}

console.log(lines.join('\n'));
