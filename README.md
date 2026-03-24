# Armut Germany

## Repository Summary

Observed: this repository is a Turborepo monorepo with a Next.js web app in `apps/web`, a NestJS API in `apps/api`, and shared package scaffolding in `packages/*`.

Inferred: the product is an Armut-style services marketplace for Germany where customers create service requests, providers send quotes, customers accept quotes, and both sides can message each other.

Observed on 2026-03-21: the repository is functional enough to inspect and run locally, but it is not in a fully green state. See [TESTING.md](./TESTING.md) for the exact failures that currently block a clean lint/typecheck/build/test run.

## Repository Map

- `apps/web`: Next.js 16 App Router frontend for customers and providers
- `apps/api`: NestJS 11 API with Prisma/PostgreSQL, JWT auth, uploads, messaging, and admin endpoints
- `packages/shared`: Zod schemas and utility helpers; currently not heavily integrated and currently breaks root type-checking
- `packages/ui`: small UI component package scaffold; currently not imported by the app code
- `packages/eslint-config`, `packages/typescript-config`: shared config packages
- `docker-compose.yml`: local Postgres and Redis only
- `.github/workflows/ci.yml`: CI pipeline and placeholder deploy jobs
- `PROJECT_GAP_REPORT.md`: product and implementation gaps tracked separately from this harness documentation

## Quick Start

### Prerequisites

- Node.js `>=18` is declared in `package.json`
- npm workspaces; the repo is pinned to `npm@10.9.2`
- Docker Desktop or another local Docker runtime if you want the provided Postgres/Redis setup

### Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local env files:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Start local infrastructure:

   ```bash
   docker compose up -d postgres redis
   ```

4. Generate Prisma client, run migrations, and seed test data:

   ```bash
   cd apps/api
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. Start the apps from the repository root:

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
npm run check-types
npm run build
npm run db:generate
npm run db:migrate
```

From `apps/api`:

```bash
npm run dev
npm run build
npm run test -- --watchman=false
npm run test:e2e -- --watchman=false
npm run db:generate
npm run db:migrate
npm run db:seed
```

From `apps/web`:

```bash
npm run dev
npm run lint
npm run check-types
npm run build
```

Important: several of these commands currently fail for repository-specific reasons. Use [TESTING.md](./TESTING.md) before assuming a failure is caused by your change.

## Seeded Test Accounts

Observed in `apps/api/prisma/seed.ts`:

- Provider
  - Email: `provider@test.com`
  - Password: `12345678`
- Customer
  - Email: `customer@test.com`
  - Password: `12345678`

The seed script also creates categories, multiple providers, sample requests, quotes, bookings, conversations, and reviews.

## Architecture At A Glance

- Frontend routing is in `apps/web/app` with route groups for `(auth)`, `(customer)`, and `(provider)`.
- Frontend data access is centralized in `apps/web/lib/api.ts`.
- Frontend auth state is managed in `apps/web/contexts/AuthContext.tsx` and stored in `localStorage`.
- Backend modules are wired in `apps/api/src/app.module.ts`.
- Database schema lives in `apps/api/prisma/schema.prisma`.
- Uploads use S3-compatible storage through `apps/api/src/modules/uploads/uploads.service.ts`.
- Realtime messaging support exists in `apps/api/src/modules/messages/messages.gateway.ts`, but the current frontend messaging UI uses REST only.

## Current Reliability Notes

Observed:

- Root `README.md` and `apps/web/README.md` were previously too weak to support safe agent work and have been rewritten.
- Root `dev:mobile` script points at a non-existent `mobile` workspace.
- Root `tsconfig.json` still extends `expo/tsconfig.base`, but there is no mobile app in this repository.
- actual hosted deployment uses the `deployment` branch, Vercel for the frontend, and Railway for the backend, while `.github/workflows/ci.yml` still contains placeholder deploy jobs for `main` and `develop`.

These are documented in more detail in:

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [TESTING.md](./TESTING.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [AGENT_GUIDE.md](./AGENT_GUIDE.md)
- [WORKFLOW.md](./WORKFLOW.md)
- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)

## Documentation Index

- [ARCHITECTURE.md](./ARCHITECTURE.md): system structure, boundaries, data flow, and danger zones
- [TESTING.md](./TESTING.md): validation commands, observed failures, and manual QA flows
- [CONTRIBUTING.md](./CONTRIBUTING.md): repo-specific change strategy and coding expectations
- [AGENT_GUIDE.md](./AGENT_GUIDE.md): operating manual for autonomous coding agents
- [WORKFLOW.md](./WORKFLOW.md): issue-driven execution workflow for repository tasks
- [ENVIRONMENT.md](./ENVIRONMENT.md): env vars, local services, and config mismatches
- [DEPLOYMENT.md](./DEPLOYMENT.md): observed CI/deploy setup and unknowns
- [apps/api/README.md](./apps/api/README.md): API-specific entry guide
- [apps/web/README.md](./apps/web/README.md): web-specific entry guide

## Known Gaps

- Quote acceptance updates request and quote status, but does not automatically create a booking.
- `services` and `reviews` backend modules are still placeholder modules.
- Frontend tests are absent.
- API e2e tests are stale and do not currently represent the actual module surface.
- Some environment variables are documented but not wired, and some wired variables are not documented correctly.

Use [PROJECT_GAP_REPORT.md](./PROJECT_GAP_REPORT.md) for product-facing feature gaps and [TESTING.md](./TESTING.md) for current verification gaps.
