# Deploylint

Lint your launch before the internet does — GO/NO-GO verdict, embarrassment radar, and Cursor fix prompts with re-scan proof.

**Test deployment:** [deploylint.com](https://deploylint.com)
(Internal package name remains `preflight` in the monorepo.)

## Product

- **Free:** verdict, embarrassment brief, social preview, one sample fix prompt
- **Paid ($9):** all Cursor fix prompts, master repair paste, unlimited re-scans with score delta
- **CI gate** — zero-install script (`/gate-remote.mjs`). See [/developers](https://deploylint.com/developers).

## Dev

```bash
npm run dev -w preflight
npm run verify:preflight
npm run deploy:preflight
npm run smoke:preflight
```
