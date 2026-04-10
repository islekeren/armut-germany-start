# Contributing

Updated for the repository state audited on April 10, 2026.

## Working Style

This repo benefits from small, explicit changes.

The codebase mixes production-facing flows, dormant scaffolding, and a few known tooling gaps. The safest contribution style is:

1. inspect the exact files involved
2. make the smallest change that solves the problem
3. run targeted validation
4. update docs when behavior, commands, or expectations changed

## Current Baseline To Know Before Editing

- root `npm run lint` passes
- root `npm run build` passes
- root `npm run check-types` fails in `packages/shared`
- API unit and e2e suites pass
- web build passes
- web type-check can be order-sensitive on a fresh checkout until `.next/types` exists

Use [TESTING.md](./TESTING.md) as the source of truth for current command behavior.

## Environment Expectations

Recommended local baseline:

```bash
npm install
docker compose up -d postgres redis
```

Then create:

- `apps/api/.env` from `apps/api/.env.example`
- `apps/web/.env.local` from `apps/web/.env.example`

See [ENVIRONMENT.md](./ENVIRONMENT.md) for the full env contract and current mismatches.

## Repo-Specific Conventions

### Frontend

- Keep backend calls in `apps/web/lib/api.ts`
- Keep auth state changes in `apps/web/contexts/AuthContext.tsx`
- Update both locale files when UI text changes:
  - `apps/web/messages/en.json`
  - `apps/web/messages/de.json`
- Prefer app-local components in `apps/web/components` over introducing new abstractions in `packages/ui`

### Backend

- Follow DTO -> controller -> service -> Prisma patterns already used in `apps/api/src/modules/*`
- Preserve auth guards and user sanitization
- Update Prisma schema, migrations, and seed data together when persistence changes
- Treat quote, booking, message, provider, upload, and notification flows as high-impact areas

### Shared packages

- Be careful changing `packages/shared`
- it currently blocks root type-checking and is not heavily integrated into the app code
- `packages/ui` exists, but the app UI is still built directly in `apps/web/components`

## Safe Validation By Change Type

### Docs-only changes

```bash
git diff --stat
```

### Frontend-only changes

```bash
cd apps/web
npm run lint
npm run build
npm run check-types
```

If `check-types` fails because `.next/types/cache-life.d.ts` is missing, run the build first and retry.

### Backend-only changes

```bash
cd apps/api
npm run lint
npm run check-types
npm run build
npm run test -- --watchman=false
```

Add e2e when routing, guards, or bootstrap code changed:

```bash
cd apps/api
npm run test:e2e -- --watchman=false
```

### Cross-cutting changes

```bash
npm run lint
npm run build
npm run check-types
```

Then add the relevant app-level checks.

## Current Quirks To Avoid “Cleaning Up” Accidentally

- `apps/mobile` is not an active workspace, even though the folder exists
- the root `tsconfig.json` still extends Expo config
- `packages/shared` still needs explicit file extensions for NodeNext
- provider `services` and `finances` pages are placeholder experiences
- `ServicesModule` and `ReviewsModule` are empty backend shells
- deploy jobs in `.github/workflows/ci.yml` are placeholders
- upload env names in `.env.example` and `UploadsService` do not match

Unless your task is explicitly a cleanup pass, do not try to fix all of these at once.

## Review Checklist

Before calling a change done, check:

- Did I edit only the files needed for the task?
- Did I preserve auth and authorization behavior?
- Did I keep translations in sync if copy changed?
- Did I update docs if commands, env vars, or workflow changed?
- Did I run the smallest relevant validations?
- Did I distinguish known repo issues from new regressions?

## Branches, Commits, And PRs

The repo does not currently encode a hard branch naming or commit message policy.

Recommended style:

- use small, focused branches
- keep commits reviewable
- mention validation results and any caveats in the PR summary
- if an issue ID exists, include it in the branch and commit names
