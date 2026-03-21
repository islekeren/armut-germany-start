---
tracker:
  kind: linear
  project_slug: "armut-germany-659bbb0d01aa"
  api_key: $LINEAR_API_KEY

workspace:
  root: ~/symphony-workspaces

hooks:
  after_create: |
    git clone https://github.com/islekeren/armut-germany-start.git .
    npm install

agent:
  max_concurrent_agents: 1
  max_turns: 20

codex:
  command: codex model_reasoning_effort=xhigh app-server
  approval_policy: never
---


You are working on a Linear issue: `{{ issue.identifier }}`

Issue context:
Identifier: {{ issue.identifier }}
Title: {{ issue.title }}
State: {{ issue.state }}
URL: {{ issue.url }}

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

## Goal

Resolve the issue with the smallest safe change, then create a branch, commit the work, push it, and open a pull request.

## Required workflow

1. Read the issue carefully.
2. Inspect the relevant code before editing.
3. Read repository docs first:
   - ARCHITECTURE.md
   - TESTING.md
   - AGENT_GUIDE.md
4. Create a new branch before making changes.

Branch naming format:
`linear/{{ issue.identifier }}-short-description`

5. Reproduce or identify the issue signal before changing code when possible.
6. Make the smallest safe implementation that resolves the issue.
7. Avoid unrelated refactors, renames, or cleanup.
8. Run the smallest relevant validation for the changed surface area.
9. If validation passes, commit the change.

Commit message format:
`{{ issue.identifier }}: short summary`

10. Push the branch to origin.
11. Open a pull request.

PR title format:
`{{ issue.identifier }}: short summary`

12. In the final response, report only:
   - what changed
   - files changed
   - validation run
   - whether push succeeded
   - PR URL if created
   - blockers if any

## Guardrails

- Work only in the provided repository copy.
- Do not modify unrelated parts of the codebase.
- Do not change architecture unless required by the issue.
- Do not merge directly to main.
- Do not stop after coding if push and PR are possible.
- If push or PR creation fails, report the exact command failure and reason.
- If repository baseline checks are already failing, distinguish baseline failures from issue-specific failures.

## Repository-specific notes

- If you touch `apps/web/lib/api.ts`, re-check downstream impact carefully because it is a central coupling point.
- Root lint and root type-check are not fully green on baseline.
- Web build currently has a known TypeScript issue in `apps/web/lib/api.ts`.
- API e2e tests are stale.
- Separate pre-existing repository failures from new regressions introduced by this task.

## Validation guidance

Use the smallest relevant validation:

- API service change:
  `cd apps/api && npm run check-types && npm run build`

- API logic change:
  `cd apps/api && npm run test -- --watchman=false`

- frontend view change:
  `cd apps/web && npm run lint`

- frontend data-layer change:
  `cd apps/web && npm run check-types`

- schema change:
  Prisma generate plus API validation

Do not claim success unless the relevant validation actually passed.