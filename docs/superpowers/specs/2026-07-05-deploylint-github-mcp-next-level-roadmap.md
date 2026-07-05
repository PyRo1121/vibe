# Deploylint Product-First Next-Level Roadmap

**Status:** Revised strategy from live competitor research on 2026-07-05
**Host:** https://deploylint.com
**Goal:** Make the core Deploylint scan/report experience world-class before using GitHub Actions and MCP as distribution multipliers.

---

## Executive Bet

Deploylint should own this promise first:

> Paste a URL and know, with painful clarity, whether it is safe to launch and exactly what to fix next.

Preflight.sh is the strongest verified competitor for local project scanning: CLI distribution, broad service detection, agent skill, dashboard history, config, and CI. Deploylint should not copy the whole product immediately. The sharper wedge is **hosted URL judgment + GitHub install + MCP fix loop**.

The revised priority is:

1. **Core product quality:** richer scan coverage, fewer false positives, clearer report hierarchy, better fix prompts, and a proof loop users trust.
2. **Product-led install:** after the report feels excellent, make GitHub installation the natural next action.
3. **Agent tooling:** after the core output is strong, MCP should expose that judgment and fix plan to agents.

GitHub and MCP still matter, but they should not be the next thing if the product itself is not yet "I would send this to another builder" good.

---

## Research Findings

### Verified Competitor: Preflight.sh

Sources:

- https://preflight.sh/
- https://preflight.sh/documentation/
- https://github.com/preflightsh/preflight

Observed strengths:

- Multi-channel CLI distribution: npm, Homebrew, Go, Docker, curl.
- Agent skill for Claude Code, Cursor, OpenCode, Codex, and other agents.
- Local project initialization via `preflight init`, plus `preflight.yml` config.
- CI mode with JSON output.
- Ignore/unsilence/list check management.
- Dashboard with published scan history and AI fix suggestions.
- Broad service detection: payments, error tracking, email, analytics, auth, chat, notifications, infrastructure, storage/CDN, search/SEO, AI/LLMs, cookie consent.
- Local codebase posture: env parity, health endpoint, dependency vulnerabilities, debug statements, legal pages, cookie consent, favicon/app icons, web manifest, robots/sitemap/llms, email auth, license.

Deploylint takeaway:

- Preflight.sh wins local install breadth today.
- Deploylint can win the hosted launch proof loop: public URL scan, shareable report, GitHub PR comment, score badge, and agent-ready fix prompts.
- We should borrow the install polish, not abandon the URL-first wedge.

### GitHub Actions Market Signal

Sources:

- https://arxiv.org/abs/2605.26825
- https://arxiv.org/abs/2602.14572
- https://arxiv.org/abs/2601.14455
- https://arxiv.org/abs/2512.11602

Observed signals:

- GitHub Actions workflows are widespread but maintenance-heavy.
- Research on 49K repositories and hundreds of thousands of workflow histories shows workflow files change frequently, and most changes are task/configuration edits.
- GitHub Actions security scanners disagree on scope and findings, which leaves room for a product with clear, actionable launch-readiness semantics.
- Over-broad workflow permissions and supply-chain risks matter; a Deploylint Action should be low-permission by default.

Deploylint takeaway:

- The action must be **boring to install** and **hard to misuse**.
- Default permissions should be read-only, with PR comments optional.
- Every failure should explain "why this blocks a launch," not just "a check failed."

### MCP Market Signal

Sources:

- https://arxiv.org/abs/2506.13538
- https://arxiv.org/abs/2510.16558
- https://arxiv.org/abs/2509.25292
- https://arxiv.org/abs/2603.13417
- https://arxiv.org/abs/2606.05339

Observed signals:

- MCP adoption is broad, but ecosystem quality is uneven.
- Studies call out tool poisoning, registry trust, schema drift, runtime faults, timeouts, ambiguous errors, and weak production governance.
- Production-grade MCP tools need tight schemas, structured errors, clear tool boundaries, and minimal permissions.

Deploylint takeaway:

- Do not make an MCP server that edits arbitrary files or shells out.
- Ship deterministic tools with typed JSON and markdown modes.
- Add MCP resources/prompts so agents can understand checks and install workflows without hallucinating commands.
- Remote MCP can be a later distribution win, but local npm stdio should be rock solid first.

---

## Current Deploylint Baseline

Already present:

- Hosted app at `https://deploylint.com`.
- URL and public GitHub repo scanning through `/api/scan`.
- GitHub gate script at `/gate-remote.mjs`.
- Vendored composite action in `.github/actions/deploylint-gate`.
- PR comments and job summaries in `gate-remote.mjs`.
- MCP package at `apps/preflight-mcp` with `deploylint_scan` and `deploylint_gate`.
- Agent skill in `skills/deploylint/SKILL.md`.
- Report badges and permalink reports.
- Alpha mode currently unlocks full reports for free.

Main gaps:

- Scan/report depth is not yet obviously better than the best competitor claim.
- Report UX can do more to explain why an issue matters and what to fix first.
- Alpha free mode needs copy consistency across app, MCP, skill, docs, terms, and privacy.
- Fix prompts need quality passes by check family.
- False-positive handling and "scan incomplete" guidance need to be more polished.
- Re-scan proof should feel like a core product loop, not an unlocked extra bolted on.
- No installable public GitHub Action package/story yet.
- MCP install requires local monorepo paths and `tsx`.
- MCP copy still references paid unlock sessions despite alpha mode.
- No MCP resources/prompts/check catalog.
- GitHub output does not yet include file-level annotations, SARIF, or installer wizard.
- No first-run setup wizard for "add Deploylint to my repo."

---

## Product Positioning

### What We Should Say

Deploylint is:

- A launch-readiness gate for vibe-coded apps.
- A hosted URL scanner plus GitHub Action plus MCP fix loop.
- Not Lighthouse, not just security scanning, not a local-only code scanner.

### What We Should Avoid

- Competing head-on with Preflight.sh as a general local CLI in the next sprint.
- Building GitHub/MCP distribution before the scan/report is excellent.
- Building a large dashboard before scan quality and user pull are proven.
- Adding broad MCP tools that can mutate repos without explicit user review.
- Over-claiming competitor gaps we cannot verify.

---

## Roadmap

### Phase 1: Core Scan Depth And Trust

**Objective:** Make the scan feel materially deeper and more trustworthy before pushing installation.

Deliverables:

- Add high-signal competitor-gap checks:
  - Web manifest.
  - Health endpoint.
  - Cookie consent.
  - ads.txt and humans.txt as low-priority checks.
  - WWW redirect consistency.
  - Large image detection.
  - Structured data quality.
- Expand service detection:
  - Payments: Paddle, Lemon Squeezy.
  - Error tracking: Sentry, LogRocket.
  - Analytics: Plausible, PostHog, GA4.
  - Auth: Clerk, Auth0, WorkOS.
  - AI: OpenAI, Anthropic, Replicate, Hugging Face.
- Expand repo scan:
  - GitHub Actions workflow safety.
  - Missing CI.
  - Unpinned Actions versions.
  - Over-broad workflow permissions.
  - Missing license and README quality.
- Add a check catalog page or hidden data source so every marketed check has:
  - ID.
  - Category.
  - Priority.
  - Why it matters.
  - How it is detected.
  - Common false positives.

Acceptance criteria:

- Every new check has unit tests.
- Check count is generated or verified, not hand-counted.
- P0 list stays small and defensible.
- `/compare`, README, homepage, and `llms.txt` use the verified count.
- Full preflight verifier passes.

Why this is next:

- Tooling spreads the product. The product needs to feel sharp first.

### Phase 2: World-Class Report UX

**Objective:** Make the report feel like an expert launch review, not a generic checklist.

Deliverables:

- Rebuild the report hierarchy around:
  - Launch blockers.
  - Conversion killers.
  - Trust/legal gaps.
  - SEO/social share risks.
  - Security/deployment hygiene.
  - Polish.
- Add "why this matters" copy for each non-passing check.
- Add "first three fixes" summary above the full checklist.
- Add scan confidence:
  - Full scan.
  - Partial scan.
  - Blocked scan.
  - Repo-only scan.
- Add evidence snippets for checks where safe:
  - Header value.
  - Missing path.
  - Response status.
  - Matched service.
  - Repo file path.
- Add false-positive affordance:
  - "This might be okay if..."
  - Copyable ignore rationale for future CI/tooling.
- Update alpha banner to say full reports are free while the product is in active development.

Acceptance criteria:

- A user can understand the top 3 fixes without scrolling through every check.
- Blocked/incomplete scans do not imply false certainty.
- Report page remains mobile-polished.
- Existing report permalink and badge behavior still work.

Why this is next:

- Users will forgive missing tooling if the report feels valuable. They will not forgive a confusing report.

### Phase 3: Fix Prompt Quality And Proof Loop

**Objective:** Make "fix and prove" the emotional center of the product.

Deliverables:

- Review and improve fix prompts by family:
  - P0 launch blockers.
  - SEO/social previews.
  - Legal/trust.
  - Security headers/exposed surfaces.
  - Repo hygiene.
  - GitHub Actions.
- Add a "master repair prompt" quality pass:
  - Ordered by P0/P1/P2.
  - Avoids over-fixing.
  - Explains what not to change.
- Make re-scan proof visible:
  - Score delta.
  - Fixed blocker count.
  - Regressions.
  - Before/after issue list.
- Add report share text that highlights one embarrassing catch.
- Add sample scans or fixtures for common app types:
  - SaaS landing page.
  - GitHub repo.
  - Blocked enterprise site.
  - Missing legal pages.

Acceptance criteria:

- Re-scan after a fixture improvement shows meaningful score delta.
- Prompt text is specific enough to paste into Cursor/Codex without rewriting.
- Report sharing does not leak private prompt details.
- Alpha full-prompt behavior is consistent across app and API.

Why this matters:

- This is the unique Deploylint loop: find the launch risk, fix it, prove it improved.

### Phase 4: Product Reliability, Limits, And Alpha Feedback

**Objective:** Make the alpha feel stable even while actively developed.

Deliverables:

- Add public alpha known-issues copy or changelog section.
- Add structured error messages:
  - Rate limited.
  - Daily capacity reached.
  - Host blocked scanner.
  - Invalid URL.
  - Repo private/not found.
- Add lightweight feedback CTA on reports.
- Add operational smoke coverage for:
  - Homepage.
  - `/api/scan`.
  - Report permalink.
  - Badge.
  - `robots.txt`, `llms.txt`, `security.txt`.
- Add regression fixtures for high-risk scan failures.

Acceptance criteria:

- Failed scans explain the user's next move.
- Alpha disclaimer is visible but not alarming.
- Smoke tests cover the public product path.
- Full deploy verify remains green.

Why this comes before tooling:

- GitHub/MCP users are less forgiving than homepage users. The API needs clear failure semantics first.

### Phase 5: GitHub Install That Feels Real

**Objective:** A user can install Deploylint in a public repo without vendoring this monorepo.

Deliverables:

- Create a separate public action package path or repository, preferably `deploylint-action`.
- Root `action.yml` with Marketplace-ready metadata.
- Include the synced `gate-remote.mjs` or a tiny Node action wrapper.
- Add install snippets:
  - Blocking gate for `main`.
  - Advisory PR-only mode.
  - Staging URL from environment or branch preview URL.
  - Manual `workflow_dispatch` with URL input.
- Add permissions guidance:
  - Minimal default: `contents: read`.
  - PR comment mode: `pull-requests: write` or `issues: write`, depending on implementation.
- Update `/developers` with a primary recommended install path.
- Update README and `llms.txt`.

Acceptance criteria:

- External workflow can use `uses: deploylint/deploylint-action@v0`.
- Job summary appears on every run.
- PR comment updates in place when permissions are configured.
- `mode: advisory` never fails the job.
- `mode: gate` fails on P0/NO-GO/score floor.

Why this is next:

- After the product output is strong, the current vendored action needs a public install path with trust and copy-paste simplicity.

### Phase 6: GitHub Output That Developers Actually Use

**Objective:** Make Deploylint failures readable in GitHub without opening the app.

Deliverables:

- Rewrite `gate-remote.mjs` markdown output around:
  - Verdict.
  - Score.
  - Top blockers.
  - "Why this blocks launch."
  - Link to full report.
  - Suggested next command.
- Add grouped output sections:
  - Launch blockers.
  - Important issues.
  - Polish.
  - Pages scanned.
  - Repo scan findings.
- Add file-level annotations for repo findings when evidence includes a path.
- Add stable JSON schema for `--json`:
  - `schemaVersion`.
  - `pass`.
  - `score`.
  - `verdict`.
  - `reasons`.
  - `issues`.
  - `reportUrl`.
  - `annotations`.
- Add `--sarif` only for repo-backed findings with file paths.

Acceptance criteria:

- GitHub job summary is useful without app context.
- JSON output is documented and tested.
- Existing consumers still pass.
- SARIF is explicitly scoped; URL-only issues do not pretend to be code scanning.

Why this matters:

- GitHub users judge tools by PR signal quality. A gate that fails but does not explain itself gets disabled.

### Phase 7: MCP Package That Installs Cleanly

**Objective:** `npx deploylint-mcp` works without cloning the monorepo.

Deliverables:

- Rename package from private `preflight-mcp` to publishable package, likely `deploylint-mcp` or `@deploylint/mcp`.
- Build package with compiled `dist`.
- Remove local `tsx` install requirement from user docs.
- Add `package.json` metadata:
  - `bin`.
  - repository.
  - keywords: `mcp`, `deploylint`, `launch-readiness`, `github-actions`, `ci`, `vibe-coding`.
  - license.
- Update `.cursor/mcp.json` snippet:

```json
{
  "mcpServers": {
    "deploylint": {
      "command": "npx",
      "args": ["deploylint-mcp"],
      "env": {
        "DEPLOYLINT_API": "https://deploylint.com"
      }
    }
  }
}
```

Acceptance criteria:

- `npm run verify:mcp` passes.
- Fresh temp repo can run the MCP server through `npx`.
- `/developers` no longer tells users to clone/copy `apps/preflight-mcp`.
- Alpha copy says full prompts are currently included free.

Why this is next:

- MCP is useless as a growth channel if install starts with "clone my monorepo."

### Phase 8: MCP Tools For Fixing, Not Just Scanning

**Objective:** Agents can convert a scan into an ordered repair plan.

Add tools:

1. `deploylint_fix_plan`
   - Input: `url`, optional `max_tasks`, optional `format`.
   - Output: ordered tasks grouped by P0/P1/P2, with copy-ready fix prompts.
   - No filesystem edits.

2. `deploylint_compare_runs`
   - Input: `previous_report_id`, `current_report_id`.
   - Output: fixed issues, regressions, score delta.
   - Lets agents summarize "what improved after my PR."

3. `deploylint_github_workflow`
   - Input: `url_secret_name`, `mode`, `min_score`, `trigger`.
   - Output: ready-to-commit GitHub Actions YAML.
   - This fills the install void without letting MCP edit files directly.

4. `deploylint_badge_markdown`
   - Input: `report_id`.
   - Output: README badge markdown and permalink.

Add resources:

- `deploylint://checks`
- `deploylint://p0`
- `deploylint://install/github-action`
- `deploylint://report/{id}` if report exists publicly

Add prompts:

- `fix_deploylint_report`
- `prepare_launch_pr`
- `install_deploylint_gate`

Acceptance criteria:

- Tools have typed JSON outputs.
- Markdown outputs remain readable.
- Errors are structured and actionable.
- No tool writes files or executes shell commands.

Why this can beat generic MCP servers:

- Generic MCP tools expose data. Deploylint can expose **launch judgment plus next action**.

### Phase 9: Hosted Remote MCP On Cloudflare

**Objective:** Remove local MCP install friction for compatible clients.

Deliverables:

- Investigate Cloudflare Worker remote MCP route, likely `/mcp`.
- Start read-only, no auth required for public scan operations.
- Add rate limiting using existing usage budget mechanisms.
- If account features arrive, add OAuth later.
- Keep stdio package as fallback.

Acceptance criteria:

- Local MCP remains supported.
- Remote MCP exposes only safe tools.
- No user secrets accepted in remote MCP alpha.
- Tool names and schemas match stdio MCP.

Why not Phase 1:

- Remote MCP is a distribution upgrade, not the core value. The local npm package must be solid first.

---

## Recommended Execution Order

1. **Core scan depth and trust**
   - Add high-signal checks, check catalog, generated/verified count, and better repo scan depth.

2. **World-class report UX**
   - Top-three fixes, evidence snippets, confidence state, false-positive guidance.

3. **Fix prompts and proof loop**
   - Better prompts, master repair prompt, re-scan delta, fixed blockers, regressions.

4. **Reliability and alpha feedback**
   - Better errors, known issues, smoke tests, public path hardening.

5. **Action package + `/developers` rewrite**
   - Distribution once the output is worth installing.

6. **GitHub annotations + JSON schema + optional SARIF**
   - Makes CI output feel professional.

7. **MCP npm package**
   - Removes monorepo install friction after scan/report semantics are stable.

8. **MCP fix-plan tools/resources/prompts**
   - Turns MCP from report reader into launch assistant.

9. **Remote MCP**
   - Big platform move after schemas stabilize.

---

## Launch Packaging

### GitHub Action Landing Promise

Headline:

> Block embarrassing launches before they merge.

Install snippet:

```yaml
name: Deploylint

on:
  pull_request:
  workflow_dispatch:
    inputs:
      url:
        description: URL to scan
        required: true

permissions:
  contents: read
  pull-requests: write

jobs:
  launch-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: deploylint/deploylint-action@v0
        with:
          url: ${{ inputs.url || secrets.DEPLOYLINT_GATE_URL }}
          mode: advisory
```

### MCP Landing Promise

Headline:

> Give your coding agent a launch-readiness sense.

Install snippet:

```json
{
  "mcpServers": {
    "deploylint": {
      "command": "npx",
      "args": ["deploylint-mcp"]
    }
  }
}
```

Primary agent command:

> Run Deploylint on my staging URL, summarize launch blockers, generate a fix plan, then tell me the first three patches to make.

---

## Risks And Guardrails

| Risk | Guardrail |
|------|-----------|
| Tooling spreads a mediocre product | Product-first phases block GitHub/MCP work until scan/report/prompt quality improves |
| MCP security concerns | Read-only tools first; no arbitrary command execution; typed outputs; structured errors |
| GitHub Action permissions scare users | Default to `contents: read`; PR comments opt-in via documented permissions |
| Competitor check-count arms race | Market verified high-signal checks, not raw count alone |
| Dashboard temptation | Defer until install + MCP produce user activity |
| Alpha free mode conflicts with MCP paid copy | Update all MCP/skill/docs copy to say full prompts are free during alpha, later paid |
| SARIF misuse | Only emit SARIF for repo findings with file evidence |

---

## Success Metrics

| Horizon | Signal |
|---------|--------|
| 1 week | Check catalog exists; top report issues explain impact and evidence |
| 2 weeks | New high-signal checks land with tests; verified check count replaces hand-wavy count |
| 3 weeks | Re-scan proof loop clearly shows fixed blockers, regressions, and score delta |
| 4 weeks | Public alpha feedback path and smoke coverage exist |
| 5 weeks | External repo can install action from public path and get job summary |
| 6 weeks | MCP installs via `npx deploylint-mcp` in a fresh repo |

---

## Open Decisions

1. Package namespace:
   - `deploylint-mcp`
   - `@deploylint/mcp`
   - `@vibe/deploylint-mcp`

2. GitHub Action distribution:
   - Separate repo `deploylint-action`
   - Root action in this monorepo
   - Subdirectory action from this monorepo

3. Remote MCP:
   - Delay until package is stable
   - Prototype in parallel on Cloudflare Worker route

Recommendation:

- Treat GitHub/MCP as Phase 5+ distribution, not Phase 1 product work.
- Use a separate public action repo for trust and Marketplace readiness when product phases are done.
- Use unscoped `deploylint-mcp` if available; otherwise `@deploylint/mcp`.
- Delay remote MCP until stdio schemas and tools stabilize.
