# Testing

Audited against the current checkout on September 11, 2026. E2E sections updated September 24, 2026.

## Current Command Matrix

| Command                                               | Scope                 | Status                   | Notes                                                                                                       |
| ----------------------------------------------------- | --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                        | whole repo            | Pass with warnings       | all lint tasks exit successfully; API lint emits 9 warnings and 0 errors                                    |
| `npm run build`                                       | whole repo            | Pass                     | builds both `web` and `api` successfully                                                                    |
| `npm run check-types`                                 | whole repo            | Pass                     | active apps and packages pass                                                                               |
| `npm run test`                                        | whole repo            | Pass with config warning | 283 tests pass on `main`: API 262, web 14, shared 4, UI 3; the root Expo `tsconfig.json` produces a warning |
| `cd apps/web && npm run lint`                         | web                   | Pass                     | `prepare-e2e.mjs` now declares its Node global                                                              |
| `cd apps/web && npm run build`                        | web                   | Pass                     | Next.js production build succeeds                                                                           |
| `cd apps/web && npm run check-types`                  | web                   | Pass                     | the script runs `next typegen` before `tsc --noEmit`                                                        |
| `cd apps/web && npm run test`                         | web unit tests        | Pass                     | 28 tests passed on September 24, 2026                                                                       |
| `cd apps/api && npm run lint`                         | api                   | Pass with warnings       | 9 warnings, 0 errors                                                                                        |
| `cd apps/api && npm run check-types`                  | api                   | Pass                     | no current TypeScript failures                                                                              |
| `cd apps/api && npm run build`                        | api                   | Pass                     | Nest build succeeds                                                                                         |
| `cd apps/api && npm run test -- --watchman=false`     | api unit tests        | Pass                     | 32 suites, 287 tests on September 24, 2026                                                                  |
| `cd apps/api && npm run test:e2e -- --watchman=false` | api e2e               | Pass                     | 15 suites, 289 tests on September 24, 2026 against `docker-compose.test.yml`                                |
| `cd apps/web && npm run test:e2e`                     | web Playwright e2e    | Pass                     | 51 tests (6 tagged `@smoke`) on September 24, 2026 against production builds                                |
| `cd packages/shared && npm run test`                  | shared unit tests     | Pass                     | 4 tests passed                                                                                              |
| `cd packages/ui && npm run test`                      | UI package unit tests | Pass                     | 3 tests passed                                                                                              |

## Running The E2E Suites Locally

Both e2e suites run against throwaway services from `docker-compose.test.yml`. Its ports are offset from the dev stack, so both stacks can run side by side:

| Service  | Host port | Purpose                                                         |
| -------- | --------- | --------------------------------------------------------------- |
| Postgres | 5433      | `armut_e2e_api` (API suite) and `armut_e2e_web` (Playwright)    |
| S3 mock  | 9190      | `adobe/s3mock` with bucket `armut-e2e-uploads`, path-style only |

Each suite has its own database: the API suite truncates tables between tests, and the Playwright prepare step resets and reseeds its database once per run. Postgres runs on tmpfs, so `down` discards everything.

```bash
npm run test:e2e:services:up         # start services and wait until healthy
npm run test:e2e:setup               # prisma generate + migrate deploy on both e2e databases

cd apps/api && npm run test:e2e      # API suite (Jest + Supertest + socket.io-client)
cd apps/web && npm run test:e2e      # reset + seed armut_e2e_web, build api+web, run all Playwright specs
cd apps/web && npm run test:e2e:smoke  # same, but only tests tagged @smoke

npm run test:e2e:services:down       # stop and drop all data
```

Notes:

- defaults live in `apps/api/test/setup-e2e.ts`, `apps/web/playwright.config.ts`, and `apps/web/scripts/prepare-e2e.mjs`; an explicit `DATABASE_URL` overrides them (CI does this)
- `test:e2e:setup` accepts `E2E_API_DATABASE_URL` and `E2E_WEB_DATABASE_URL` overrides
- the web prepare step truncates every table in the target database before seeding. It refuses databases whose name does not contain `e2e` or `test` unless `E2E_ALLOW_RESET=true`
- Playwright serves production builds (`node dist/main`, `next start`) by default; the prepare step builds them through turbo, which caches repeat runs. `E2E_SKIP_BUILD=true` skips the build, and `E2E_DEV_SERVERS=true` uses watch-mode dev servers instead (no build)
- Playwright starts the API with `NODE_ENV=test` and `THROTTLE_DISABLED=true` so the per-IP auth rate limits do not trip when many test users log in
- if your Playwright version has no matching bundled browser, point it at a local Chromium with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
- with `E2E_DEV_SERVERS=true`, `nest start --watch` can leave an orphaned `apps/api/dist/main` process on port 4000 after Playwright exits; kill it if the next run reports the URL is already in use
- behind a TLS-intercepting proxy, `next build` may fail to download Google Fonts; trust the proxy CA with `NODE_EXTRA_CA_CERTS` and set `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1`

### E2E harness conventions (API)

- `createTestApp()` in `apps/api/test/e2e-utils.ts` boots `AppModule` through `configureApp()` from `apps/api/src/app.setup.ts`, the same HTTP setup `main.ts` uses (Helmet, CORS, validation pipe, `/api` prefix). Pass an override callback to swap providers, as `app.e2e-spec.ts` does to mock Prisma
- build state with the fixtures (`createUserFixture`, `createProviderFixture`, `createAdminFixture`, `createRequestFixture`, `createQuoteFixture`, `createBookingFixture`, `createDealFixture`, `createConversationFixture`) and call `resetAndSeedDatabase()` in `beforeEach`
- authenticate with `loginAs(app, email)` and send `.set(bearer(token))`
- `setup-e2e.ts` sets `THROTTLE_DISABLED=true` for the whole suite; `throttling.e2e-spec.ts` turns it off locally to prove the auth limits still hold
- `authorization.e2e-spec.ts` holds tables of protected, admin-only, and public routes and checks them against the routes Express actually registers. When you add a controller route, add it to one of those tables or the drift check fails

### API e2e coverage

| Spec                                          | Covers                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `app.e2e-spec.ts`                             | routing, validation, and guard smoke checks with Prisma mocked                                                   |
| `admin.e2e-spec.ts`                           | user listing/search/paging, verify-only updates, deletion, provider approval, canonical categories, reports      |
| `auth.e2e-spec.ts`                            | register, refresh, verify, change password, duplicate registration                                               |
| `authorization.e2e-spec.ts`                   | 401 on every protected route, 403 on admin routes, request/user/provider ownership, route-table drift            |
| `bookings.e2e-spec.ts`                        | booking creation, status state machine, cancel side effects, reschedule, reviews and replies, visibility, paging |
| `messages.e2e-spec.ts`                        | conversation create/dedupe, participant validation, send, unread counts, read receipts, history paging, lockout  |
| `messages-gateway.e2e-spec.ts`                | socket auth, room joins, `newMessage`/`messageNotification` fan-out, leave, read receipts, typing                |
| `notifications.e2e-spec.ts`                   | ordering, unread filter, limit, mark one/all read, ownership                                                     |
| `providers.e2e-spec.ts`                       | provider profile creation and updates, public profile, review replies                                            |
| `public-catalog.e2e-spec.ts`                  | health, categories, provider search by category/rating/postcode, provider detail, public request board, paging   |
| `quotes.e2e-spec.ts`                          | quote create/edit/withdraw rules, accept/reject side effects, visibility                                         |
| `requests-bookings-notifications.e2e-spec.ts` | end-to-end request → quote → booking → notifications flow                                                        |
| `throttling.e2e-spec.ts`                      | login rate limit and the `NODE_ENV=test` guard on `THROTTLE_DISABLED`                                            |
| `uploads.e2e-spec.ts`                         | direct uploads per folder against the S3 mock, type/size/count limits, presigned uploads, owner-only deletion    |
| `users.e2e-spec.ts`                           | profile read/update whitelist, account anonymisation for customers and providers, active-booking guard           |

Known gaps: payments (not on `main`), and socket behaviour for deleted accounts and non-participant typing, which are open issues rather than covered behaviour.

### E2E harness conventions (web)

- `e2e/support/data.ts` creates each test's users, providers, requests, quotes, bookings, conversations, and notifications directly in `armut_e2e_web` with unique emails. Tests never rely on seed content or on each other, so they run in parallel
- `e2e/support/test.ts` extends Playwright's `test` with an English-locale `page` and a `loginAs(user)` fixture that logs in through the API and seeds AuthContext's `localStorage` once per tab. Use `signIn(page, user)` for extra browser contexts
- pages that confirm with `window.confirm` need `page.on("dialog", (d) => d.accept())`; Playwright dismisses dialogs by default
- providers are listed by rating, so pass `topRated: true` to `createProvider` when a test must find a new provider in a paginated list
- tag tests that guard the core loop with `@smoke`; PR CI runs only those

### Web e2e coverage

| Spec                        | Covers                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `public.spec.ts`            | home, categories, category and find-provider search, provider profile, request board privacy, 404            |
| `auth.spec.ts`              | register (customer, provider hand-off, password mismatch), login redirect and off-site guard, logout         |
| `customer-requests.spec.ts` | request wizard, status tabs, accept quote → create booking, unbookable pending quote, foreign request        |
| `customer-bookings.spec.ts` | bookings list and filters, reschedule, cancel, confirm completion, review                                    |
| `customer-account.spec.ts`  | profile, password change, account deletion and its active-booking guard, notifications                       |
| `provider.spec.ts`          | send offer, unapproved provider blocked, complete an order, reply to a review, edit profile, dashboard pages |
| `messaging.spec.ts`         | customer and provider exchange messages in two browser contexts; starting a chat from a quote                |
| `admin.spec.ts`             | provider approval and the non-admin notice                                                                   |
| `i18n.spec.ts`              | German default, language toggle, no raw message keys on public and signed-in pages in both locales           |
| `resilience.spec.ts`        | API 500, unreachable API, expired session                                                                    |
| `journey.spec.ts`           | full cross-role loop: request → offer → booking → completion → review → provider reply                       |

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

When the change affects a user-facing flow, also run the browser suite (services from `docker-compose.test.yml` must be up):

```bash
cd apps/web
npm run test:e2e:smoke   # quick; or npm run test:e2e for everything
```

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

- lint and type-check gate everything else
- API unit tests, web unit tests, the web build, and the API build run on every push and PR
- `e2e-api` runs the full API e2e suite against Postgres and the `adobe/s3mock` service
- `e2e-web` runs Playwright against production builds in Chromium only: the `@smoke` subset on pull requests, the full suite on pushes, the nightly schedule, and manual dispatch
- Playwright HTML reports are uploaded for every run and traces/videos for failures
- deploy jobs are still placeholders; they now also require both e2e jobs and run only on pushes

Practical meaning:

- CI is useful for lint, build, API, and browser coverage
- root lint is a usable gate again, although its API warning baseline should still be reduced to zero
- deploy jobs do not prove that an application was released because they only print placeholder messages

## Reporting Guidance

When you finish a task, report validation in two parts:

1. what you ran
2. whether any failures were real regressions, known repo issues, or environment-specific caveats
