# Testing

## Validation Philosophy

This repository does not currently have a fully green validation baseline.

Observed on 2026-03-21:

- Some commands pass.
- Some commands fail because of real repository issues.
- One build failure was initially sandbox-related, but the build still fails outside the sandbox because of an actual TypeScript error.

Use this document to separate baseline failures from regressions introduced by your work.

## Command Matrix

| Command                                               | Scope                | Observed Status             | Notes                                                                                                                                  |
| ----------------------------------------------------- | -------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                        | whole monorepo       | Fails                       | `apps/web` treats warnings as fatal; current failure is unused `getApiBaseUrl` in `apps/web/lib/api.ts`. API lint also emits warnings. |
| `npm run check-types`                                 | whole monorepo       | Fails                       | `packages/shared` fails under `NodeNext` because internal exports omit file extensions.                                                |
| `cd apps/api && npm run check-types`                  | API only             | Passes                      | Useful fast validation for backend-only changes.                                                                                       |
| `cd apps/api && npm run build`                        | API only             | Passes                      | Confirms Nest production build.                                                                                                        |
| `cd apps/api && npm run test`                         | API unit tests       | Fails in sandbox by default | Default Jest tries to use Watchman in restricted environments.                                                                         |
| `cd apps/api && npm run test -- --watchman=false`     | API unit tests       | Mostly passes               | 223 tests pass, 1 stale categories service assertion fails.                                                                            |
| `cd apps/api && npm run test:e2e -- --watchman=false` | API e2e tests        | Fails                       | `supertest` import style is wrong and tests reference a non-existent search module.                                                    |
| `cd apps/web && npm run lint`                         | web only             | Fails                       | Same unused-function warning as root lint.                                                                                             |
| `cd apps/web && npm run check-types`                  | web only             | Fails                       | `tsconfig` includes `.next/types/**/*.ts`, but `cache-life.d.ts` is missing after `next typegen`.                                      |
| `cd apps/web && npm run build`                        | web production build | Fails                       | Real TypeScript error: `API_URL` is undefined in `apps/web/lib/api.ts`.                                                                |

## Observed Failures In Detail

### Root lint

Observed failure:

- `apps/web/lib/api.ts` defines `getApiBaseUrl` but does not use it.

Observed warning-only issues in API lint:

- undeclared env warnings from Turborepo for API env vars
- unused args/imports in several API files
- CommonJS `module` warnings in Jest config files

Practical meaning:

- Root lint is not a reliable "green or red" gate for unrelated work right now.

### Root type-check

Observed failure:

- `packages/shared/src/index.ts` and `packages/shared/src/types/index.ts` use extensionless relative exports while the package is configured with `moduleResolution: NodeNext`.

Practical meaning:

- Root type-check does not currently measure the health of `apps/web` or `apps/api` reliably, because it fails earlier in a shared package that the apps are not actively importing.

### API unit tests

Observed baseline:

- Default `npm run test` can fail in restricted environments because Jest uses Watchman.
- `npm run test -- --watchman=false` is the more dependable command.

Observed failing test:

- `apps/api/src/modules/categories/categories.service.spec.ts` expects `findMany()` to be called without the `_count.services` include that the service now uses.

Practical meaning:

- The unit suite is close to usable, but not fully trustworthy until that stale assertion is updated.

### API e2e tests

Observed failures:

- `apps/api/test/app.e2e-spec.ts` imports `supertest` as `import * as request`, which is not callable with the current TypeScript setup.
- The same file references `/api/search/providers` and `/api/search/requests`, but no search module is registered in `AppModule`.

Practical meaning:

- Do not rely on the current e2e suite as a reflection of the live API surface.

### Web type-check and build

Observed failures:

- `apps/web` type-check expects `.next/types/cache-life.d.ts`, but it is missing after `next typegen`.
- `apps/web` production build fails with `Cannot find name 'API_URL'` in `apps/web/lib/api.ts`.

Practical meaning:

- Frontend validation currently has a real blocker in the shared API client file.

## Fastest Safe Validation Paths

### Docs-only changes

Run:

```bash
git diff --stat
```

Practical note:

- For documentation-only changes, repository code validation is optional, but you should still avoid editing docs that contradict the current code.

### Backend-only changes in `apps/api`

Minimum:

```bash
cd apps/api
npm run check-types
npm run build
```

Recommended when touching service or controller logic:

```bash
cd apps/api
npm run test -- --watchman=false
```

### Frontend-only changes in `apps/web`

Minimum:

```bash
cd apps/web
npm run lint
```

Recommended:

```bash
cd apps/web
npm run check-types
npm run build
```

Important:

- At the time of writing, `check-types` and `build` already fail for known baseline reasons. If your change does not touch `apps/web/lib/api.ts` or frontend tsconfig behavior, report those failures as pre-existing unless you fixed them intentionally.

### Schema or state-machine changes

Run:

```bash
cd apps/api
npm run db:generate
npm run check-types
npm run build
npm run test -- --watchman=false
```

Also perform manual QA on the affected flow. See below.

## Manual QA Flows

### Customer flow

Use the seeded customer account:

- Email: `customer@test.com`
- Password: `12345678`

Suggested manual checks:

1. Log in.
2. Create a service request.
3. Visit `/my-requests`.
4. Open a request detail page.
5. Accept a quote if test data allows.
6. Open customer messages.

### Provider flow

Use the seeded provider account:

- Email: `provider@test.com`
- Password: `12345678`

Suggested manual checks:

1. Log in.
2. Open `/dashboard`.
3. Review provider requests, profile, reviews, and messages.
4. Open a public provider profile page.

### API smoke checks

Suggested local checks:

- Open Swagger at `http://localhost:4000/api/docs`
- Verify `/api/categories`
- Verify `/api/providers`
- Verify authenticated `/api/auth/me`

## CI Reality

Observed in `.github/workflows/ci.yml`:

- CI runs lint, API tests, web build, API build, e2e, and placeholder deploy jobs.
- CI installs Playwright browsers and tries Playwright tests.

Observed repository mismatch:

- No Playwright config or frontend test files were found.
- API e2e tests are stale.

Practical meaning:

- The checked-in CI pipeline is aspirational in places. Treat it as a signal of intent, not as proven truth.

## Known Gaps In Verification

- No frontend unit test suite found
- No Playwright tests found
- API e2e suite is stale
- Root lint/type-check are not green
- Web build is not green
- Root validation is not a dependable merge gate without first fixing existing baseline failures

## Recommended Validation Checklist For Agents

Before editing:

- Read this file and identify which checks are already failing on baseline.

After editing:

- Re-run the smallest relevant passing checks first.
- Only run broader checks when your change touches shared or cross-cutting code.
- Report validation in two parts:
  - what you ran
  - whether any failures were new or pre-existing
