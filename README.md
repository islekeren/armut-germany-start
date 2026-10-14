# Armut Germany

Audited against the current checkout on September 11, 2026.

## Overview

This repository is a Turborepo monorepo for an Armut-style services marketplace.

Active application workspaces:

- `apps/web`: Next.js 16 App Router frontend for public, customer, and provider flows
- `apps/api`: NestJS 11 backend with Prisma, JWT auth, uploads, messaging, bookings, quotes, and notifications
- `apps/mobile`: Expo Router mobile client; native login/register plus a WebView wrapping `apps/web`, with a two-way auth bridge and push notifications

Supporting packages:

- `packages/shared`: shared types and utilities
- `packages/ui`: small component package scaffold; no direct app imports were found during this audit
- `packages/eslint-config`, `packages/typescript-config`: shared tooling config

Mobile workspace state:

- `apps/mobile` is a real npm workspace (it has its own `package.json`) and passes `lint` and `check-types`
- the WebView-vs-native direction has been chosen: a thin native shell (auth screens, push, session bridge) around the same web app, not a full native rewrite
- still missing before store submission: app icon/splash, a final decision on the app name (`app.json` currently says "Workify Germany" while the rest of the repo says "Armut Germany"), and EAS build/submit credentials (Apple/Google developer accounts, APNs/FCM push credentials)
- push notifications only cover quote/booking/request events today; new chat messages do not yet trigger a push (messaging uses its own Socket.IO gateway, not `NotificationsService`)
- Stripe Checkout/Connect return URLs are not yet wired to Universal Links/App Links, so a payment redirect currently drops the user into the system browser instead of back into the app — not urgent while payments are still on the unmerged `codex/stripe-connect-payments` branch
- `apps/mobile` was developed on `claude/zen-gauss-tazw97`; see that branch/PR for the current state before assuming anything below is merged into `main`

## Current Validation Snapshot

Observed on September 11, 2026:

- `npm run lint`: passes; API lint reports 9 warnings and no errors
- `npm run build`: passes
- `npm run check-types`: passes
- `npm run test`: passes 283 unit tests across the active workspaces and packages
  - API: 262 tests in 30 suites
  - web: 14 tests
  - `packages/shared`: 4 tests
  - `packages/ui`: 3 tests
- API e2e was not rerun in this audit because the local Docker daemon was unavailable; the suite previously passed outside the restricted sandbox
- the root Expo-based `tsconfig.json` still causes a configuration warning during unit-test runs even though all tests pass

Use [TESTING.md](./docs/TESTING.md) for the detailed command matrix and caveats.

## Quick Start

### Prerequisites

- Node.js `>=20.9.0` is declared in the root and active app `package.json` files
- CI uses Node `20.x`, which is the safest local baseline
- npm workspaces with `npm@10.9.2`
- Docker if you want the provided local Postgres and Redis services

### Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create env files:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Start local services:

   ```bash
   docker compose up -d postgres redis
   ```

4. Prepare the database from `apps/api`:

   ```bash
   cd apps/api
   npm run db:generate
   npm run db:migrate
   NODE_ENV=development npm run db:seed
   ```

5. Start the active apps from the repo root:

   ```bash
   cd ../..
   npm run dev
   ```

### Local URLs

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs`

## Common Commands

From the repository root:

```bash
npm run dev
npm run dev:web
npm run dev:api
npm run lint
npm run build
npm run check-types
npm run db:generate
npm run db:migrate
```

Important repo-specific notes:

- `npm run dev` targets `web` and `api` only; it does not start the mobile app
- `npm run dev:all` now also starts `apps/mobile` (`expo start`) alongside web and api, since mobile is a real workspace
- `npm run dev:mobile` starts just the Expo dev server; set `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_WEB_URL` first (see `apps/mobile/.env.example`)

## Seeded Accounts

Observed in `apps/api/prisma/seed.ts`:

- Provider
  - Email: `provider@test.com`
  - Password: `12345678`
- Customer
  - Email: `customer@test.com`
  - Password: `12345678`
- Admin
  - Email: `admin@test.com`
  - Password: `12345678`

The demo seed requires explicit `NODE_ENV=development` or `test`; production, staging, and unset runtimes are rejected before database access. It also creates request taxonomy categories, additional providers, quotes, bookings, reviews, conversations, and notifications-related data paths.

## Provider Approval

New providers start unapproved: they can browse requests but cannot send quotes, and their dashboard shows a "profile under review" notice. An admin approves them at `/admin/providers`.

Admins cannot sign up through the app. Promote an existing, non-provider account against the target database with:

```bash
npm run admin:grant --workspace=api -- someone@example.com
```

## Location Matching

Requests and providers are matched by distance. The API derives coordinates from German postcodes (client-sent coordinates are ignored when the postcode is known):

- a request's location comes from its postcode; unknown postcodes are rejected
- a provider's service-area centre comes from their business postcode, and their radius (`serviceAreaRadius`, default 25 km) limits the requests they see
- `GET /api/providers?postalCode=12345` returns providers whose radius reaches that postcode
- providers without a postcode are not filtered by distance

Rows created before this existed are stored at 0,0. Fix them once per environment with:

```bash
npm run geo:backfill --workspace=api
```

Postcode coordinates come from [GeoNames](https://www.geonames.org/) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); keep that attribution (e.g. on the imprint/privacy page). Regenerate the data with `apps/api/scripts/build-postcode-data.mjs`.

## Repository Map

- `apps/web/app`: App Router pages for public, auth, customer, and provider areas
- `apps/web/components`: app-local UI building blocks
- `apps/web/lib/api.ts`: frontend API client and typed request helpers
- `apps/api/src/modules`: NestJS controllers and services by domain
- `apps/api/prisma/schema.prisma`: database schema
- `apps/api/prisma/seed.ts`: development seed data
- `apps/mobile/app`: Expo Router native auth screens and the WebView screen
- `apps/mobile/src/lib/routing.ts`: web URL helpers, the native/WebView auth-sync script, and push-notification deep-link resolution
- `docker-compose.yml`: local Postgres and Redis only
- `.github/workflows/ci.yml`: validation on `main` and `develop`
- `.github/workflows/mirror-deployment.yml`: fast-forward compatibility mirror after successful main CI
- `.github/workflows/verify-release.yml`: manual verification of the running API/web release
- `railway.json`: API build, migration and database readiness checks for Railway
- `apps/web/vercel.json`: Next.js hosting config (Vercel Root Directory `apps/web`)
- `docs/OBSERVABILITY.md`: private-data-safe logs, correlation IDs and incident triage
- `render.yaml`: API service definition for Render
- `Dockerfile`: Node API image with Prisma generation, NestJS compilation and a production start command

## Current Product Notes

- Quote acceptance does not auto-create a booking. The frontend redirects the customer to `/bookings/new` after accepting a quote.
- Public routes such as `/help`, `/pricing`, `/success-stories`, `/privacy`, and `/terms` currently resolve to generic coming-soon pages.
- Provider `services` and `finances` are placeholders on `main`; the payment feature branch replaces `finances` with Stripe Connect test-mode onboarding and Express Dashboard access.
- The payment feature branch uses separate charges and transfers: the platform collects the payment and releases the provider share after customer-confirmed completion.
- The Stripe payment work is synchronized with `origin/main` in draft PR [#8](https://github.com/islekeren/armut-germany-start/pull/8), but it is not released and remains blocked by payment-safety work.
- `ServicesModule` and `ReviewsModule` are still empty backend shells.
- Notifications are now a real API module and frontend page, and also fan out as Expo push notifications to the mobile app (quote/booking/request events only, not yet new chat messages).

## Documentation Index

- [docs/README.md](./docs/README.md): documentation folder index
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md): system shape, core flows, and danger zones
- [ENVIRONMENT.md](./docs/ENVIRONMENT.md): env vars, local services, and configuration status
- [STRIPE_SANDBOX.md](./docs/STRIPE_SANDBOX.md): local Connect onboarding, webhooks, and delayed-transfer testing
- [TESTING.md](./docs/TESTING.md): validated command status as of September 11, 2026
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md): what is and is not encoded in the repo for deployment
- [CONTRIBUTING.md](./docs/CONTRIBUTING.md): repo-specific contribution guidance
- [AGENTS.md](./AGENTS.md): operating instructions for coding agents
- [WORKFLOW.md](./docs/WORKFLOW.md): suggested change workflow for this repo
- [PROJECT_GAP_REPORT.md](./docs/PROJECT_GAP_REPORT.md): remaining product and platform gaps from this audit
- [IMPLEMENTATION_ROADMAP.md](./docs/IMPLEMENTATION_ROADMAP.md): ordered Linear implementation sequence and release gates
- [apps/web/README.md](./apps/web/README.md): frontend-specific guide
- [apps/api/README.md](./apps/api/README.md): backend-specific guide
- [apps/mobile/README.md](./apps/mobile/README.md): mobile-specific guide

## Known Repository Quirks

- The root `tsconfig.json` still extends Expo config, but nothing reads it: `apps/mobile` has its own `tsconfig.json` with the same `extends`. Harmless, but worth removing if it causes confusion.
- API lint currently passes with 9 warnings rather than a warning-free baseline.
- `apps/web` generates Next.js types before type-checking, but stale generated state can still make fresh-checkout failures worth investigating build-first.
- The upload env names now match between `apps/api/.env.example` and `UploadsService`.
- Selected production topology: Railway API + Vercel web, with `main` as the release source. Hosting domains, dashboard gates and branch protection still require external verification; see [DEPLOYMENT.md](./docs/DEPLOYMENT.md).
- Railway pre-deploy runs migrations only. Demo seeding is blocked outside explicit development/test runtimes; existing hosted databases still require a check for previously seeded accounts.
- The checked-in `Dockerfile` builds and starts the API. Railway owns pre-deploy migrations and readiness checks; the image currently retains build dependencies.

## Recommended Branch Policy

- Use `main` as the canonical integration and release branch.
- Develop work on short-lived branches and merge through reviewed pull requests after required checks pass.
- Do not commit directly to `main` or keep long-running product work only on `deployment`.
- Keep `codex/stripe-connect-payments` synchronized with `origin/main`; resolve the release blockers documented in draft PR [#8](https://github.com/islekeren/armut-germany-start/pull/8) before merging it into `main`.
- Keep `deployment` as a compatibility mirror of `main`; do not merge feature work into it directly, and synchronize it only after reviewed changes land on `main`.

This is the recommended repository policy, not proof of the current settings in Railway, Render, Vercel, or another external hosting dashboard.
