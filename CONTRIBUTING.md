# Contributing

## Purpose

This repository needs contributions to be small, explicit, and repository-aware.

The codebase contains working features, scaffolding, and stale validation/configuration in the same tree. A good contribution improves one thing without accidentally "fixing" or reshaping unrelated parts of the repository.

## Ground Rules

- Keep edits minimal and scoped to the task.
- Do not refactor broadly unless the task is explicitly a refactor.
- Do not treat currently stale scripts, CI steps, or scaffolding as safe cleanup unless cleanup is the task.
- Preserve auth, request/quote/booking state transitions, and public API shapes unless the task explicitly changes them.
- Update documentation when you change developer workflow, validation behavior, or environment requirements.

## Environment Expectations

Observed:

- Node `>=18` is declared.
- CI uses Node `20.x`.
- npm workspaces are the active package manager model.

Recommended local baseline:

```bash
npm install
docker compose up -d postgres redis
```

Then configure env files as described in [ENVIRONMENT.md](./ENVIRONMENT.md).

## Repository-Specific Conventions

### Frontend

- Add or change API calls in `apps/web/lib/api.ts`.
- Add or change auth behavior in `apps/web/contexts/AuthContext.tsx`.
- Keep translation keys in sync across `apps/web/messages/en.json` and `apps/web/messages/de.json`.
- Prefer app-local components in `apps/web/components` over inventing new shared abstractions in `packages/ui`.

### Backend

- Follow DTO -> controller -> service -> Prisma patterns already used in `apps/api/src/modules/*`.
- Keep validation in DTO classes where possible.
- Return sanitized user data and avoid exposing password hashes or raw user records.
- If you add or change database fields, update Prisma schema, migration, and seed data together.

### Shared packages

- Be cautious changing `packages/shared` and `packages/ui`.
- They look like shared infrastructure, but the app code is not strongly coupled to them today.
- `packages/shared` currently breaks root type-checking; do not assume it is battle-tested.

## Safe Change Strategy

### Preferred approach

1. Inspect the exact page, component, controller, service, or schema involved.
2. Make the smallest edit that addresses the task.
3. Validate only the relevant surface first.
4. Document pre-existing failures separately from new failures.

### Avoid this

- broad naming cleanups across many files
- unrequested style churn
- replacing app-local patterns with new abstractions
- changing route structure casually
- changing env var names without updating examples and docs
- changing state-machine semantics without tracing all affected flows

## Validation Expectations

Use [TESTING.md](./TESTING.md) for the current command baseline.

Minimum expectation per change:

- Backend-only change: API type-check and API build
- Frontend-only change: web lint at minimum; type-check/build when relevant
- Schema change: Prisma generate plus API validation and manual QA
- Cross-cutting change: validate both apps

When a baseline failure prevents a full green run, call it out explicitly instead of hiding it.

## Branching And PR Expectations

Observed:

- CI is configured for pushes and PRs to `main` and `develop`.

Unknown:

- Branch naming rules
- Commit message convention
- Review policy

Recommended contribution style:

- Use small, reviewable branches and commits.
- Keep each PR or task focused on one problem.
- Include validation results and known residual risks in the summary.

## Manual Review Checklist

Before considering a change complete, ask:

- Did I edit only the files necessary for this task?
- Did I preserve the intended auth and authorization behavior?
- Did I keep translations in sync if UI copy changed?
- Did I update docs if commands, env vars, or workflows changed?
- Did I run the smallest relevant validations?
- Did I note any baseline failures that still remain?

## Known Repository Quirks

- `package.json` still contains a `dev:mobile` script, but no mobile app exists.
- Root `tsconfig.json` still extends Expo config, but no Expo app exists.
- CI references Playwright and deploy jobs that are not fully backed by checked-in repo assets.
- Web build and root type-check are not green on baseline.

Do not "clean up everything" in the same change unless the task is specifically a cleanup pass.
