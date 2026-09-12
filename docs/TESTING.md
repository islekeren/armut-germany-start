# Testing

Audited against the current checkout on September 11, 2026.

## Current Command Matrix

| Command                                               | Scope                 | Status                   | Notes                                                                                                           |
| ----------------------------------------------------- | --------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                        | whole repo            | Pass with warnings       | all lint tasks exit successfully; API lint emits 9 warnings and 0 errors                                        |
| `npm run build`                                       | whole repo            | Pass                     | builds both `web` and `api` successfully                                                                        |
| `npm run check-types`                                 | whole repo            | Pass                     | active apps and packages pass                                                                                   |
| `npm run test`                                        | whole repo            | Pass with config warning | 283 tests pass on `main`: API 262, web 14, shared 4, UI 3; the root Expo `tsconfig.json` produces a warning     |
| `cd apps/web && npm run lint`                         | web                   | Pass                     | `prepare-e2e.mjs` now declares its Node global                                                                  |
| `cd apps/web && npm run build`                        | web                   | Pass                     | Next.js production build succeeds                                                                               |
| `cd apps/web && npm run check-types`                  | web                   | Pass                     | the script runs `next typegen` before `tsc --noEmit`                                                            |
| `cd apps/web && npm run test`                         | web unit tests        | Pass                     | 14 tests passed                                                                                                 |
| `cd apps/api && npm run lint`                         | api                   | Pass with warnings       | 9 warnings, 0 errors                                                                                            |
| `cd apps/api && npm run check-types`                  | api                   | Pass                     | no current TypeScript failures                                                                                  |
| `cd apps/api && npm run build`                        | api                   | Pass                     | Nest build succeeds                                                                                             |
| `cd apps/api && npm run test -- --watchman=false`     | api unit tests        | Pass                     | 30 suites, 262 tests passed on `main`                                                                           |
| `cd apps/api && npm run test:e2e -- --watchman=false` | api e2e               | Not rerun in this audit  | Docker daemon was unavailable on September 11, 2026; the suite previously passed outside the restricted sandbox |
| `cd packages/shared && npm run test`                  | shared unit tests     | Pass                     | 4 tests passed                                                                                                  |
| `cd packages/ui && npm run test`                      | UI package unit tests | Pass                     | 3 tests passed                                                                                                  |

## Current Caveats

### API lint warnings

Root and API lint now exit successfully. API lint still reports 9 warnings in cache, auth, bookings, messages, and requests code. They do not currently fail CI, but a warning-free baseline would make future lint regressions easier to spot.

### Root Expo TypeScript configuration warning

The root `tsconfig.json` still extends `expo/tsconfig.base` even though `apps/mobile` is not an active npm workspace. Unit tests pass, but tooling can emit a warning while loading the root config. Treat that as known scaffolding debt, not a failed test.

### Web generated types

The web `check-types` script now runs `next typegen` before TypeScript, which removes the previously documented build-first dependency. If a fresh checkout still reports missing `.next/types` files, rerun the command after clearing stale generated state and record the exact failure.

### API e2e caveat in restricted environments

Observed sequence on April 10, 2026:

1. `cd apps/api && npm run test:e2e -- --watchman=false` failed in the sandbox with `listen EPERM: operation not permitted 0.0.0.0`
2. the same command passed outside the sandbox

Current interpretation:

- the e2e suite itself is green
- some restricted environments need elevated execution to let Supertest bind a local server
- the September 11 audit could not reconfirm it because the local Docker daemon was unavailable; do not report a fresh e2e pass from this audit

## Current Warning Baseline

`cd apps/api && npm run lint` currently exits successfully but reports 9 warnings in these areas:

- unused args/imports in cache, auth, bookings, messages, and requests code

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

The script generates Next.js types itself. If generated-type failures recur, capture and investigate them rather than treating build-first as a permanent required step.

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
- Playwright e2e is configured through `apps/web/playwright.config.ts`
- deploy jobs are still placeholders

Practical meaning:

- CI is useful for lint, build, and API coverage
- root lint is a usable gate again, although its API warning baseline should still be reduced to zero
- deploy jobs do not prove that an application was released because they only print placeholder messages

## Reporting Guidance

When you finish a task, report validation in two parts:

1. what you ran
2. whether any failures were real regressions, known repo issues, or environment-specific caveats
