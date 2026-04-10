# Testing

Audited against the repository on April 10, 2026.

## Current Command Matrix

| Command | Scope | Status | Notes |
| --- | --- | --- | --- |
| `npm run lint` | whole repo | Pass | exits cleanly; API lint still emits 15 warnings |
| `npm run build` | whole repo | Pass | builds both `web` and `api` successfully |
| `npm run check-types` | whole repo | Fail | blocked by `packages/shared` NodeNext export-path errors |
| `cd apps/web && npm run lint` | web | Pass | clean in current workspace |
| `cd apps/web && npm run build` | web | Pass | Next.js production build succeeds |
| `cd apps/web && npm run check-types` | web | Pass with caveat | passed after `.next/types` existed; on a fresh checkout it can fail until `cache-life.d.ts` is generated |
| `cd apps/api && npm run lint` | api | Pass with warnings | 15 warnings, 0 errors |
| `cd apps/api && npm run check-types` | api | Pass | no current TypeScript failures |
| `cd apps/api && npm run build` | api | Pass | Nest build succeeds |
| `cd apps/api && npm run test -- --watchman=false` | api unit tests | Pass | 27 suites, 248 tests passed |
| `cd apps/api && npm run test:e2e -- --watchman=false` | api e2e | Pass with environment caveat | passed outside the sandbox; in a restricted sandbox it failed with `EPERM` while binding a local server |

## Current Failures

### Root type-check

Observed failure:

- `packages/shared/src/index.ts` and `packages/shared/src/types/index.ts` re-export extensionless relative paths
- with NodeNext resolution, TypeScript now requires explicit file extensions

Current effect:

- root `npm run check-types` fails before it becomes a reliable repo-wide gate

### Web clean-checkout caveat

Observed sequence on April 10, 2026:

1. `cd apps/web && npm run check-types` failed because `.next/types/cache-life.d.ts` was missing
2. `cd apps/web && npm run build` succeeded
3. `cd apps/web && npm run check-types` then passed

Current interpretation:

- this is not a proven code failure in `apps/web`
- it is a generated-types ordering issue worth knowing about on a fresh checkout

### API e2e caveat in restricted environments

Observed sequence on April 10, 2026:

1. `cd apps/api && npm run test:e2e -- --watchman=false` failed in the sandbox with `listen EPERM: operation not permitted 0.0.0.0`
2. the same command passed outside the sandbox

Current interpretation:

- the e2e suite itself is green
- some restricted environments need elevated execution to let Supertest bind a local server

## Current Warning Baseline

`cd apps/api && npm run lint` currently exits successfully but reports warnings in these areas:

- CommonJS `module` usage in Jest config files
- unused args/imports in cache, auth, bookings, messages, and requests code
- `turbo/no-undeclared-env-vars` warnings for `CORS_ORIGINS` and `PORT` in `apps/api/src/main.ts`

These warnings do not currently fail lint.

## Recommended Validation Strategy

### Docs-only changes

Minimum:

```bash
git diff --stat
```

### Frontend-only changes

Recommended order:

```bash
cd apps/web
npm run lint
npm run build
npm run check-types
```

If `check-types` fails on a fresh checkout with a missing `.next/types` file, run the build first and retry.

### Backend-only changes

Recommended order:

```bash
cd apps/api
npm run lint
npm run check-types
npm run build
npm run test -- --watchman=false
```

When the change touches controller wiring or bootstrapping, also run:

```bash
cd apps/api
npm run test:e2e -- --watchman=false
```

### Cross-cutting changes

Recommended order:

```bash
npm run lint
npm run build
npm run check-types
```

Then add the relevant app-level checks if your change touches business logic, schema, auth, or messaging.

## Manual QA Accounts

Seeded development accounts:

- Provider: `provider@test.com` / `12345678`
- Customer: `customer@test.com` / `12345678`

Suggested manual checks:

1. log in as the customer and create or inspect a request
2. accept a quote and verify the flow moves to `/bookings/new`
3. create or inspect a booking
4. open customer messages and notifications
5. log in as the provider and inspect dashboard requests, orders, reviews, and messages

## CI Reality

Observed in `.github/workflows/ci.yml`:

- API unit tests run in CI
- API e2e tests run in CI
- web builds run in CI
- Playwright is skipped automatically unless config and tests are present
- deploy jobs are still placeholders

Practical meaning:

- CI is useful for lint, build, and API coverage
- root type-check is still not a dependable gate until `packages/shared` is fixed

## Reporting Guidance

When you finish a task, report validation in two parts:

1. what you ran
2. whether any failures were real regressions, known repo issues, or environment-specific caveats
