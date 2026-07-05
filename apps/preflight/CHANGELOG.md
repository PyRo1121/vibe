# Changelog

All notable **user-facing** changes to [Deploylint](https://lint.latham.cloud) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for `apps/preflight` releases (`0.MINOR.PATCH` until 1.0).

**How we write this file:** commits use [Conventional Commits](https://www.conventionalcommits.org/) for structure; `npm run changelog:draft` suggests bullets — then a human curates `[Unreleased]` before each deploy. We do **not** paste raw `git log` here.

## [Unreleased]

### Added

- _Nothing yet._

## [0.35.0] - 2026-07-05

Phase 28b-35: DKIM probe, changelog page, Plausible proxy.

### Added

- DKIM DNS probe (`dkim-dns`) when SPF is present — common `_domainkey` selectors.
- Public `/changelog` page rendering `CHANGELOG.md`.
- First-party Plausible proxy (`/s/script.js`, `/s/event`) for verifier + ad-blocker resilience.
- `deploylint.com` → canonical host 301 redirect (when DNS points at Worker).

### Changed

- Official Plausible analytics via deferred script + `window.plausible` (replaces NPM tracker).

## [0.34.0] - 2026-07-04

Phase 32–34 — founder conversion UX.

### Added

- Score delta badge and fixed-blocker diff after unlocked re-scans (`ScoreDeltaBadge`, session baseline checks).
- Post-unlock progress ring and completed fix-loop state.
- `/compare` page with named competitors (ShipReady, WebsiteReady, PageLens).
- Master prompt line count and “Fix everything in one Cursor paste” on unlock panels.

### Changed

- Privacy policy discloses Plausible analytics.

## [0.31.0] - 2026-07-04

Phase 26–31 — check depth + developer wedge.

### Added

- Seven deployment-hygiene checks (exposed `.env`/`.git`, health endpoint, web manifest, debug-in-bundle).
- MCP tools `deploylint_scan` / `deploylint_gate` (legacy `preflight_*` aliases).
- Agent skill and `gate-remote.mjs --json`; P0 gate list synced with new blockers.
- Marketing copy: **90+ checks**.

## [0.26.0] - 2026-07-04

Deploylint rebrand on `lint.latham.cloud`.

### Changed

- User-facing brand Preflight → Deploylint; live Stripe on DeployLint account.

## [0.25.0] - 2026-07-02

### Added

- KV-backed unlock persistence — paid re-scans verify without re-hitting Stripe every time.

[unreleased]: https://github.com/PyRo1121/vibe/compare/deploylint-v0.35.0...HEAD
[0.35.0]: https://github.com/PyRo1121/vibe/compare/deploylint-v0.34.0...deploylint-v0.35.0
[0.34.0]: https://github.com/PyRo1121/vibe/compare/deploylint-v0.31.0...deploylint-v0.34.0
[0.31.0]: https://github.com/PyRo1121/vibe/compare/deploylint-v0.26.0...deploylint-v0.31.0
[0.26.0]: https://github.com/PyRo1121/vibe/compare/deploylint-v0.25.0...deploylint-v0.26.0
[0.25.0]: https://github.com/PyRo1121/vibe/commits/deploylint-v0.25.0
