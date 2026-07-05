#!/usr/bin/env node
/**
 * Cut [Unreleased] in CHANGELOG.md to a versioned release and write GitHub release notes.
 *
 * Usage:
 *   node scripts/changelog-release.mjs 0.35.0
 *   node scripts/changelog-release.mjs 0.35.0 --title "Founder funnel polish"
 *
 * Then:
 *   git tag deploylint-v0.35.0
 *   git push origin deploylint-v0.35.0
 *   gh release create deploylint-v0.35.0 --title "Deploylint v0.35.0" --notes-file apps/preflight/.release-notes.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const RELEASE_NOTES = join(ROOT, '.release-notes.md');

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
	console.error('Usage: node scripts/changelog-release.mjs <semver> [--title "..."]');
	process.exit(1);
}

const titleIdx = process.argv.indexOf('--title');
const subtitle = titleIdx >= 0 ? process.argv[titleIdx + 1] : '';

const today = new Date().toISOString().slice(0, 10);
const text = readFileSync(CHANGELOG, 'utf8');

const unreleasedRe =
	/## \[Unreleased\]\s*\n([\s\S]*?)(?=\n## \[\d+\.\d+\.\d+\]|\n\[unreleased\]:|$)/;
const match = text.match(unreleasedRe);
if (!match) {
	console.error('No ## [Unreleased] section found in CHANGELOG.md');
	process.exit(1);
}

const unreleasedBody = match[1].trim();
if (!unreleasedBody || unreleasedBody === '_Nothing yet._') {
	console.error('[Unreleased] is empty. Add curated bullets before cutting a release.');
	process.exit(1);
}

const prevVersionRe = /^## \[(\d+\.\d+\.\d+)\]/m;
const prevMatch = text.match(prevVersionRe);
const prevVersion = prevMatch?.[1] ?? null;

const newTag = `deploylint-v${version}`;
const prevTag = prevVersion ? `deploylint-v${prevVersion}` : null;

let newSection = `## [${version}] - ${today}\n`;
if (subtitle) newSection += `\n${subtitle}\n`;
newSection += `\n${unreleasedBody}\n`;

const freshUnreleased = `## [Unreleased]\n\n### Added\n\n- _Nothing yet._\n`;

let updated = text.replace(unreleasedRe, `${freshUnreleased}\n${newSection}\n`);

// Update [unreleased] compare link
const unreleasedLink = prevTag
	? `[unreleased]: https://github.com/PyRo1121/vibe/compare/${newTag}...HEAD`
	: `[unreleased]: https://github.com/PyRo1121/vibe/compare/${newTag}...HEAD`;

if (/\[unreleased\]:/.test(updated)) {
	updated = updated.replace(/\[unreleased\]:[^\n]*/, unreleasedLink);
} else {
	updated = `${updated.trim()}\n\n${unreleasedLink}\n`;
}

// Insert version compare link before older links
const versionLink = prevTag
	? `[${version}]: https://github.com/PyRo1121/vibe/compare/${prevTag}...${newTag}`
	: `[${version}]: https://github.com/PyRo1121/vibe/commits/${newTag}`;

if (!updated.includes(`[${version}]:`)) {
	updated = updated.replace(
		/(\[unreleased\]:[^\n]*\n)/,
		`$1[${version}]: ${versionLink.split(': ')[1]}\n`
	);
}

writeFileSync(CHANGELOG, updated.endsWith('\n') ? updated : `${updated}\n`);

const notes = [
	`# Deploylint v${version}`,
	subtitle ? `\n${subtitle}\n` : '',
	unreleasedBody,
	'',
	`Full changelog: https://github.com/PyRo1121/vibe/blob/main/apps/preflight/CHANGELOG.md#${version.replace(/\./g, '')}-${today.replace(/-/g, '')}`
].join('\n');

writeFileSync(RELEASE_NOTES, notes);

console.log(`Updated CHANGELOG.md → [${version}] - ${today}`);
console.log(`Wrote ${RELEASE_NOTES}`);
console.log('');
console.log('Next:');
console.log(`  git add apps/preflight/CHANGELOG.md`);
console.log(`  git commit -m "chore(preflight): release v${version}"`);
console.log(`  git tag ${newTag}`);
console.log(`  git push origin main && git push origin ${newTag}`);
console.log(
	`  gh release create ${newTag} --title "Deploylint v${version}" --notes-file apps/preflight/.release-notes.md`
);
