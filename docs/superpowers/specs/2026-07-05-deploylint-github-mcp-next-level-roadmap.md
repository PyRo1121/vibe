# Deploylint GitHub + MCP Next-Level Roadmap

**Status:** Draft strategy from live competitor research on 2026-07-05  
**Host:** https://deploylint.com  
**Goal:** Make Deploylint the easiest launch-readiness gate to install in GitHub and the most useful MCP tool for agents fixing launch blockers.

---

## Executive Bet

Deploylint should own this promise:

> Paste your URL, get a launch verdict, then install the same verdict in GitHub and your coding agent in under five minutes.

Preflight.sh is the strongest verified competitor for local project scanning: CLI distribution, broad service detection, agent skill, dashboard history, config, and CI. Deploylint should not copy the whole product immediately. The sharper wedge is **hosted URL judgment + GitHub install + MCP fix loop**.

The first public launch should make these two installs feel real:

1. **GitHub Action:** one copy-paste workflow, polished PR comment, job summary, advisory mode, and clear marketplace-style install story.
2. **MCP:** installable npm package, clean JSON outputs, agent prompts/resources, and fix-plan tools that help Cursor/Codex/Claude go from finding to patch plan.

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
- Building a large dashboard before install/distribution works.
- Adding broad MCP tools that can mutate repos without explicit user review.
- Over-claiming competitor gaps we cannot verify.

---

## Roadmap

### Phase 1: GitHub Install That Feels Real

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

- The current vendored action works for our repo, but outside users need trust and copy-paste simplicity.

### Phase 2: GitHub Output That Developers Actually Use

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

### Phase 3: MCP Package That Installs Cleanly

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

### Phase 4: MCP Tools For Fixing, Not Just Scanning

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

### Phase 5: Hosted Remote MCP On Cloudflare

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

### Phase 6: Competitor Depth Without Losing Focus

**Objective:** Close the most visible Preflight.sh feature gaps that matter to launch readiness.

Prioritized checks:

- Web manifest.
- Health endpoint.
- Cookie consent.
- ads.txt and humans.txt as low-priority checks.
- Service detection expansion:
  - Payments: Paddle, Lemon Squeezy.
  - Error tracking: Sentry, LogRocket.
  - Analytics: Plausible, PostHog, GA4.
  - Auth: Clerk, Auth0, WorkOS.
  - AI: OpenAI, Anthropic, Replicate, Hugging Face.
- Repo scan additions:
  - GitHub Actions workflow safety.
  - Missing CI.
  - Unpinned Actions versions.
  - Over-broad workflow permissions.

Acceptance criteria:

- Checks remain launch-readiness oriented.
- P0 list stays small.
- Marketing count can move from "90+" to a verified count without hand-waving.

Why this later:

- More checks help comparison pages, but install/distribution needs to work first.

---

## Recommended Execution Order

1. **Action package + `/developers` rewrite**
   - Highest distribution value.
   - Makes alpha users able to install something real.

2. **MCP npm package**
   - Removes monorepo install friction.
   - Lets us say "works in Cursor/Codex/Claude" honestly.

3. **MCP fix-plan tools/resources/prompts**
   - Turns MCP from report reader into launch assistant.

4. **GitHub annotations + JSON schema + optional SARIF**
   - Makes CI output feel professional.

5. **Remote MCP**
   - Big platform move after schemas stabilize.

6. **Preflight.sh depth gap checks**
   - Better compare page and stronger scan output.

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
| 1 week | External repo can install action from public path and get job summary |
| 2 weeks | MCP installs via `npx deploylint-mcp` in a fresh repo |
| 3 weeks | Agent can call scan, gate, fix_plan, and github_workflow without reading docs |
| 4 weeks | 5 external repos have installed action or MCP during alpha |
| 6 weeks | 1 public README badge or PR comment screenshot used in marketing |

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

- Use a separate public action repo for trust and Marketplace readiness.
- Use unscoped `deploylint-mcp` if available; otherwise `@deploylint/mcp`.
- Delay remote MCP until stdio schemas and tools stabilize.
