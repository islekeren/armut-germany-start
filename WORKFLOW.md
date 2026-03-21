# Workflow

## Goal

This workflow is designed for issue-driven work by coding agents in this repository.

It prioritizes:

- minimal safe edits
- repo-specific inspection before implementation
- honest validation
- explicit handling of incomplete information

## Step 1: Interpret The Task

Classify the task first:

- frontend UI or route issue
- backend API or business logic issue
- auth or permissions issue
- database/schema issue
- docs or workflow issue
- infra/deploy/config issue

Then identify:

- which app is affected
- whether the task changes behavior or only presentation
- whether the task is likely to touch a danger zone

## Step 2: Inspect Before Editing

Always read the nearest relevant files before planning.

Typical inspection set:

- route/page file
- controller
- service
- DTO
- Prisma schema if persistence is involved
- API client wrapper if frontend/backend coupling is involved
- translation files if user-facing text changes

Also read the relevant root docs:

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [TESTING.md](./TESTING.md)
- [AGENT_GUIDE.md](./AGENT_GUIDE.md)

## Step 3: Form A Minimal Plan

A good plan in this repository is usually 2-4 steps.

Example structure:

1. inspect the affected flow
2. edit the smallest files needed
3. run targeted validation
4. summarize results and residual risks

Avoid speculative plans like:

- "clean up related code while here"
- "migrate to a new shared abstraction"
- "fix all warnings in touched files"

unless the issue explicitly asks for that.

## Step 4: Implement Conservatively

While editing:

- preserve existing architecture unless the task requires a redesign
- avoid touching unrelated files
- keep API contract changes explicit
- keep translations in sync
- keep docs in sync when workflow or runtime behavior changes

Repo-specific rule:

- If you touch `apps/web/lib/api.ts`, re-check the downstream impact carefully because it is a central coupling point.

## Step 5: Validate By Surface Area

Pick the smallest relevant validations first.

Examples:

- API service change: `cd apps/api && npm run check-types && npm run build`
- API logic change: add `npm run test -- --watchman=false`
- frontend view change: `cd apps/web && npm run lint`
- frontend data-layer change: add `npm run check-types` and `npm run build`
- schema change: Prisma generate plus API validation plus manual QA

Use [TESTING.md](./TESTING.md) to distinguish baseline failures from new regressions.

## Step 6: Handle Incomplete Information

When information is missing:

- prefer observed facts from code
- label inferences explicitly
- document unknowns instead of inventing certainty

Stop and ask for clarification when:

- business rules are unclear
- deployment behavior must change
- auth or payment semantics would change
- a schema migration requires guessing data behavior

## Step 7: Summarize Precisely

Final reporting should include:

- files changed
- behavioral outcome
- validation run
- pre-existing failures still present
- follow-up risks or unknowns

Do not claim "all checks pass" unless they actually pass.

## Repository-Specific Constraints

- Root lint and root type-check are not fully green on baseline.
- Web build is currently broken by a real TypeScript issue in `apps/web/lib/api.ts`.
- API e2e tests are stale.
- CI contains aspirational steps that do not fully match the checked-in repo state.

Implication:

- A good workflow summary must separate repository baseline problems from the task-specific result.

## Safe Completion Criteria

Work can be considered safely complete when:

- the requested behavior or documentation change is implemented
- affected files were inspected before edit
- the smallest relevant validations were run
- no unrelated refactor was introduced
- remaining failures and unknowns are clearly reported
