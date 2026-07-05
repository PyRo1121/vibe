# Changelog & release notes (Deploylint)

Research-backed workflow for this repo. **Goal:** every deploy has curated, user-facing notes — not a dump of `git log`.

## What the internet agrees on (2025–2026)

| Source | Takeaway |
|--------|----------|
| [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) | `CHANGELOG.md`, `[Unreleased]` on top, six categories, ISO dates, **no commit-log diffs** |
| [Conventional Commits](https://www.conventionalcommits.org/) | Machine-readable commits → **draft** changelog bullets; still human-edited |
| [Unmarkdown — Changelog best practices](https://unmarkdown.com/blog/changelog-best-practices) | One markdown source; publish to site + GitHub Releases |
| Release tools (`release-please`, `git-cliff`, `semantic-release`) | Automate **drafting** and versioning; **review before publish** |

**Commits ≠ changelog.** A commit documents a step in code evolution. A changelog entry documents what **users** should care about (often one bullet per feature, spanning several commits).

**Release notes ≠ full changelog.** Release notes = one version’s section (copy from `CHANGELOG.md` into GitHub Release body).

## Two-layer system (what we use)

### Layer 1 — Commits (developers)

Use **Conventional Commits** on `apps/preflight` and related paths:

```
<type>(<scope>): <imperative summary>

[optional body — why, not what diff already shows]
```

| Type | Use for | Maps to changelog |
|------|---------|-------------------|
| `feat` | User-visible feature | **Added** |
| `fix` | User-visible bug | **Fixed** |
| `change` / `refactor` | Behavior change | **Changed** |
| `perf` | Speed | **Changed** |
| `security` | Vuln / exposure | **Security** |
| `docs`, `chore`, `ci`, `test`, `build` | Internal | Usually **omit** from user changelog |

Breaking changes: `feat!:` or `BREAKING CHANGE:` in body → **Changed** + callout.

**Good:** `feat(compare): add ShipReady and PageLens columns`  
**Bad:** `wip`, `fix stuff`, `Phase 32 stuff` (fine for squash message, rewrite Unreleased before release)

### Layer 2 — CHANGELOG.md (users)

- File: [`apps/preflight/CHANGELOG.md`](../../../apps/preflight/CHANGELOG.md)
- Always maintain **`## [Unreleased]`** while shipping
- On release: rename to `## [0.34.0] - YYYY-MM-DD`, add fresh `[Unreleased]`, tag, GitHub Release

Categories only when non-empty: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, **Security**.

Write for founders scanning before launch — not for engineers reading diffs.

## Per-commit → per-release flow

```
1. Land PRs with conventional commits
2. npm run changelog:draft -w preflight     # suggests bullets from git
3. Paste + edit into [Unreleased] in CHANGELOG.md
4. npm run verify:preflight && smoke && deploy
5. npm run changelog:release -w preflight -- 0.35.0   # moves Unreleased → version, prints GH body
6. git tag deploylint-v0.35.0 && git push --tags
7. gh release create deploylint-v0.35.0 --notes-file apps/preflight/.release-notes.md
```

Versioning (pre-1.0): `0.MINOR.PATCH` — MINOR ≈ roadmap phase batch; PATCH = fix-only deploy.

Tags: `deploylint-v0.34.0` (scoped to product, not whole monorepo).

## GitHub Releases

- **Title:** `Deploylint v0.34.0`
- **Body:** Copy the version section from `CHANGELOG.md` (not auto-generated “full changelog” from GitHub unless you curate it)
- Link compare: `https://github.com/PyRo1121/vibe/compare/deploylint-v0.31.0...deploylint-v0.34.0`

## Anti-patterns

- Pasting `git log --oneline` into release notes
- Letting Dependabot/Renovate commits appear in user-facing notes
- Empty version gaps (if it shipped, it gets an entry)
- Changelog only on GitHub Releases (keep portable `CHANGELOG.md` in repo)

## Optional upgrades (later)

- **release-please** — auto PRs that bump version + CHANGELOG (good for monorepos)
- **git-cliff** — prettier draft from conventional commits
- Public `/changelog` page on `lint.latham.cloud` rendering `CHANGELOG.md`

## Quick commands

```powershell
cd apps/preflight
npm run changelog:draft          # since last deploylint-v* tag
npm run changelog:release -- 0.35.0
```
