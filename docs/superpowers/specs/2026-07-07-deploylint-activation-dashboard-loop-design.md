# Deploylint Activation Dashboard Loop Design

## Objective

Make `/app` feel like the subscribed product home for Deploylint, not a placeholder dashboard or a URL scanner wrapper. The first improvement loop should turn a logged-in user into an activated workspace user by showing exactly what to do next: define a project, install the advisory workflow, receive the first CI report, then switch to a blocking deploy gate.

This is the first loop in the broader product sequence:

1. Activation dashboard
2. Auth production readiness
3. CI gate onboarding

Each loop should ship as a narrow, verifiable product increment with tests, browser smoke checks, and a commit/deploy checkpoint.

## Scope

Build a better `/app` command center using the current auth/session foundation and existing demo workspace model. Do not build full database-backed project CRUD in this slice. The purpose is to make the product direction obvious and marketable while preserving a small implementation surface.

Included:

- A stronger dashboard hierarchy focused on activation status and next action.
- A setup progress model for project creation, advisory install, first report, and gate enablement.
- A project setup card that makes the user feel they are configuring a CI/deploy product.
- A GitHub Actions install card with clearer copy, copy affordance, and advisory-mode framing.
- Empty states for report history and gate status that describe the paid product loop.
- A billing/account status panel that ties subscription value to projects, reports, and gates.
- Focused tests for the workspace activation model and app page source.

Excluded:

- Persisting projects in D1.
- Pulling live GitHub repository data.
- Receiving real CI reports into the workspace.
- Building a full account settings area.
- Changing the homepage scanner/report behavior.

## Product Shape

The dashboard should answer four questions within the first viewport:

- What is my current deploy-control status?
- What should I do next?
- What project is this attached to?
- What value does a subscription unlock here?

Recommended layout:

- Top band: workspace title, signed-in user, and a compact activation score or status.
- Primary left panel: "Next action" with one clear CTA.
- Primary right panel: subscription/account status and included project limit.
- Main section: project setup card with deploy target, repo label, workflow path, gate mode, and minimum score.
- Install section: advisory workflow snippet with copy button and explanation that advisory mode is non-blocking.
- Report history section: empty state now; later becomes the first CI report list.
- Gate section: status card showing advisory first, blocking later.

The dashboard should not look like marketing copy. It should feel like a quiet DevOps control surface: dense, scannable, and action oriented.

## Data Model

Extend the existing workspace model rather than creating a new persistence layer.

Add derived activation concepts in `apps/preflight/src/lib/product/workspace.ts`:

- `ActivationStepStatus`: `complete | current | locked`
- `WorkspaceActivationStep`: id, label, description, status, cta label, href or anchor
- `WorkspaceNextAction`: label, description, cta label, href or anchor
- `activationProgress`: completed count, total count, percentage

For now, derive all values from the existing `DeploylintWorkspace` and `DeploylintProject` demo state:

- `not_installed` means project setup is current or workflow install is current, depending on the final page model.
- `advisory_installed` means first report is current.
- `gate_enabled` means activation is complete.

The implementation should keep the model deterministic and easy to test. No browser state should be required to compute activation steps.

## UX Behavior

The first dashboard loop should support these states:

- Signed-out user: existing redirect to `/login?redirectTo=%2Fapp` remains.
- Signed-in empty/demo user: sees the activation path and can copy the advisory workflow.
- Missing GitHub/Resend provider secrets: do not block dashboard rendering; those warnings belong to the auth readiness loop.
- No report history: show a useful empty state, not a blank area.
- Alpha mode: keep alpha access visible, but do not make it the primary story.

Primary CTA priority:

1. Complete project setup
2. Copy/install advisory workflow
3. Open first report
4. Enable blocking gate

Only one action should be visually dominant at a time.

## Technical Design

Files likely involved:

- `apps/preflight/src/lib/product/workspace.ts`
- `apps/preflight/src/lib/product/workspace.test.ts`
- `apps/preflight/src/routes/app/+page.server.ts`
- `apps/preflight/src/routes/app/+page.svelte`
- `apps/preflight/src/routes/app/page.server.test.ts`
- Add or update an app page source test if needed.

Implementation principles:

- Keep the page server load simple: authenticated user plus demo workspace plus advisory workflow.
- Put activation derivation in `$lib/product/workspace`, not inside the Svelte component.
- Avoid adding a UI component library or new design system.
- Use existing Tailwind/zinc/sky styling and the current dashboard shell.
- Prefer copy buttons and status labels over explanatory paragraphs.
- Avoid nested cards where possible; cards should represent discrete tools or repeated items.

## Error Handling

This slice has limited runtime failure modes:

- If no project exists in the workspace model, show a project setup empty state instead of assuming index `0`.
- If copying the workflow fails, show a local button-level error state.
- If the user is not authenticated, preserve the existing server redirect.

## Testing

Required verification:

- Unit tests for activation step derivation across `not_installed`, `advisory_installed`, and `gate_enabled`.
- Existing app page server tests still pass for redirect/authenticated load.
- Source-level or component-level test confirms the dashboard includes activation/next-action/install/report-history surfaces.
- `npm.cmd run verify -w preflight` passes.
- Browser smoke checks:
  - `/` returns 200.
  - `/login` returns 200.
  - Anonymous `/app` returns 303 to login.

## Success Criteria

This loop succeeds when a new visitor can understand from `/app` that Deploylint is a CI hardening and deploy-gate workspace, not just a scanner:

- The dashboard has a clear next action.
- The install path is obvious.
- The report/gate empty states describe the paid product loop.
- The current scanner remains available elsewhere without being the dashboard's center of gravity.
- The implementation is verified, committed, pushed, and deployable.
