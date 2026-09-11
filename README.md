# Armut Germany

Audited against the current checkout on September 11, 2026.

## Overview

This repository is a Turborepo monorepo for an Armut-style services marketplace.

Active application workspaces:

- `apps/web`: Next.js 16 App Router frontend for public, customer, and provider flows
- `apps/api`: NestJS 11 backend with Prisma, JWT auth, uploads, messaging, bookings, quotes, and notifications

Supporting packages:

- `packages/shared`: shared types and utilities
- `packages/ui`: small component package scaffold; no direct app imports were found during this audit
- `packages/eslint-config`, `packages/typescript-config`: shared tooling config

Dormant workspace state:

- `apps/mobile` contains Expo leftovers (`.expo`, `.env`, `expo-env.d.ts`) but no `package.json`, so it is not an active npm workspace

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
   npm run db:seed
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

- `npm run dev` targets `web` and `api`
- `npm run dev:all` currently resolves to the same active workspaces because there is no mobile npm workspace
- `npm run dev:mobile` is stale until `apps/mobile` becomes a real workspace

## Seeded Accounts

Observed in `apps/api/prisma/seed.ts`:

- Provider
  - Email: `provider@test.com`
  - Password: `12345678`
- Customer
  - Email: `customer@test.com`
  - Password: `12345678`

The seed also creates request taxonomy categories, additional providers, quotes, bookings, reviews, conversations, and notifications-related data paths.

## Repository Map

- `apps/web/app`: App Router pages for public, auth, customer, and provider areas
- `apps/web/components`: app-local UI building blocks
- `apps/web/lib/api.ts`: frontend API client and typed request helpers
- `apps/api/src/modules`: NestJS controllers and services by domain
- `apps/api/prisma/schema.prisma`: database schema
- `apps/api/prisma/seed.ts`: development seed data
- `docker-compose.yml`: local Postgres and Redis only
- `.github/workflows/ci.yml`: CI plus placeholder deploy jobs on `main` and `develop`
- `railway.json`: API build and deploy commands for Railway
- `render.yaml`: API service definition for Render
- `Dockerfile`: incomplete Node build-image scaffold; it is not yet a runnable production image

## Current Product Notes

- Quote acceptance does not auto-create a booking. The frontend redirects the customer to `/bookings/new` after accepting a quote.
- Public routes such as `/help`, `/pricing`, `/success-stories`, `/privacy`, and `/terms` currently resolve to generic coming-soon pages.
- Provider `services` and `finances` are placeholders on `main`; the payment feature branch replaces `finances` with Stripe Connect test-mode onboarding and Express Dashboard access.
- The payment feature branch uses separate charges and transfers: the platform collects the payment and releases the provider share after customer-confirmed completion.
- The Stripe payment work has not yet been merged into `origin/main`; do not treat it as released until the branch is synchronized, reviewed, validated, and merged.
- `ServicesModule` and `ReviewsModule` are still empty backend shells.
- Notifications are now a real API module and frontend page.

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

## Known Repository Quirks

- The root `tsconfig.json` still extends Expo config even though there is no active mobile workspace.
- API lint currently passes with 9 warnings rather than a warning-free baseline.
- `apps/web` generates Next.js types before type-checking, but stale generated state can still make fresh-checkout failures worth investigating build-first.
- The upload env names now match between `apps/api/.env.example` and `UploadsService`.
- Railway and Render API configs are checked in, but the production hosting topology and externally configured deployment branch are not confirmed by the repository alone.
- `railway.json` currently runs `db:seed` during every pre-deploy; remove that before using it for production deploys.
- The checked-in `Dockerfile` has no final build, runtime command, or production stage and should not yet be treated as a deployable image.

## Recommended Branch Policy

- Use `main` as the canonical integration and release branch.
- Develop work on short-lived branches and merge through reviewed pull requests after required checks pass.
- Do not commit directly to `main` or keep long-running product work only on `deployment`.
- Synchronize `codex/stripe-connect-payments` with `origin/main`, resolve and validate the combined changes, then merge it into `main`.
- Keep `deployment` as a compatibility mirror of `main`; do not merge feature work into it directly, and synchronize it only after reviewed changes land on `main`.

This is the recommended repository policy, not proof of the current settings in Railway, Render, Vercel, or another external hosting dashboard.
