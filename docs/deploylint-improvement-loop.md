# Deploylint Continuous Improvement Loop

## Current Bet

Deploylint should narrow around deploy readiness for builders shipping with AI coding tools:

- top-of-funnel: GitHub Actions hardening checker plus deploy-target and repository readiness evidence
- core promise: catch common deploy blockers before production
- paid reason: history, monitoring, deltas, alerts, private reports, and deeper repair guidance

Avoid positioning the product as a generic toolbox. Every new slice should make the deploy decision clearer, safer, or easier to adopt.

## Weekly Cadence

1. **Direction**
   CEO, market, and monetization agents choose one product bet.

2. **Shape**
   CTO, engineer, security, and DevEx agents turn the bet into one shippable slice.

3. **Build**
   Main builder implements. Subagents only edit code when file ownership is disjoint and explicit.

4. **Ship Gate**
   QA, security, DevEx, and scrutinizer review the diff and user path.

5. **Learn**
   Record adoption, activation, conversion, error, and support signals. Kill or adjust the bet if the signal does not improve after two cycles.

## Role Outputs

- **CEO:** one-sentence bet, success metric, kill condition
- **Market:** current alternatives, demand signal, positioning gap
- **Monetization:** free vs paid boundary, plan impact, willingness-to-pay reason
- **CTO:** architecture risks, sequencing, infrastructure to avoid
- **Engineer:** concrete implementation plan, affected files, test plan
- **QA:** browser flows, regression risks, required smoke tests
- **Security:** trust boundaries, overclaims, abuse cases, safe wording
- **DevEx:** first-run flow, docs friction, CLI/GitHub Actions adoption path
- **Scrutinizer:** strongest failure case and what evidence would change it

## Decision Gates

- **Intake gate:** user-facing outcome, metric, and kill condition exist.
- **Build gate:** slice is smaller than one week and does not require speculative infrastructure.
- **Security gate:** required for URL fetching, repo scanning, Stripe, auth, webhooks, Workers bindings, MCP, stored reports, or CI gating claims.
- **Revenue gate:** paid-feature work names the affected plan, entitlement, and upgrade path.
- **Ship gate:** targeted tests, browser smoke, and known risks are documented.

## Current Backlog

1. Make the GitHub Actions checker more trustworthy:
   - structured YAML parsing
   - line-specific findings
   - deploy job `needs` / `environment` checks
   - unsafe untrusted context checks beyond `pull_request_target`

2. Tighten developer adoption:
   - one canonical advisory workflow
   - `DEPLOYLINT_*` env vars with `PREFLIGHT_*` aliases
   - real `--help` for gate scripts
   - docs for advisory mode before blocking mode

3. Align paid packaging:
   - free: workflow risk check, temporary advisory evidence, and a basic gate
   - paid: monitored projects, history, deltas, alerts, full fix prompts, private reports, and repair loops
   - de-emphasize MCP as a headline paid reason until it is externally installable

4. Improve trust messaging:
   - state evidence limitations near tools and reports
   - distinguish sampled repository evidence from full audits
   - avoid claims that imply workflows are proven secure

5. Platform backbone:
   - shared gate/report contract
   - policy versioning
   - hosted run model
   - later: GitHub App, scheduled monitoring, private repo support

## Stop Rules

- Do not run the full role loop for tiny fixes; use engineer plus QA only.
- Do not add new checker pages until the top-of-funnel checker has adoption proof.
- Do not build monitoring, GitHub App, or agency features until the free checker/gate path activates real users.
- Do not keep work that does not map to activation, retention, revenue, risk reduction, or launch confidence.
