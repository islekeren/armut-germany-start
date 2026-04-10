# Armut Germany

Audited against the repository on April 10, 2026.

## Overview

This repository is a Turborepo monorepo for an Armut-style services marketplace.

Active application workspaces:

- `apps/web`: Next.js 16 App Router frontend for public, customer, and provider flows
- `apps/api`: NestJS 11 backend with Prisma, JWT auth, uploads, messaging, bookings, quotes, and notifications

Supporting packages:

- `packages/shared`: shared types and utilities, but still the source of the current root type-check failure
- `packages/ui`: small component package scaffold; no direct app imports were found during this audit
- `packages/eslint-config`, `packages/typescript-config`: shared tooling config

Dormant workspace state:

- `apps/mobile` contains Expo leftovers (`.expo`, `.env`, `expo-env.d.ts`) but no `package.json`, so it is not an active npm workspace

## Current Validation Snapshot

Observed on April 10, 2026:

- `npm run lint`: passes
- `npm run build`: passes
- `npm run check-types`: fails in `packages/shared` because NodeNext exports use extensionless relative paths
- `cd apps/api && npm run check-types`: passes
- `cd apps/api && npm run build`: passes
- `cd apps/api && npm run test -- --watchman=false`: passes
- `cd apps/api && npm run test:e2e -- --watchman=false`: passes outside the sandbox; in restricted environments it can fail with `EPERM` when Supertest tries to bind a local server
- `cd apps/web && npm run lint`: passes
- `cd apps/web && npm run build`: passes
- `cd apps/web && npm run check-types`: passes in the current workspace after `.next/types` exists; on a fresh checkout it may fail until `cache-life.d.ts` has been generated

Use [TESTING.md](./TESTING.md) for the detailed command matrix and caveats.

## Quick Start

### Prerequisites

- Node.js `>=18` is declared in the root `package.json`
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

## Current Product Notes

- Quote acceptance does not auto-create a booking. The frontend redirects the customer to `/bookings/new` after accepting a quote.
- Public routes such as `/help`, `/pricing`, `/success-stories`, `/privacy`, and `/terms` currently resolve to generic coming-soon pages.
- Provider `services` and `finances` pages exist, but they are still placeholder experiences.
- `ServicesModule` and `ReviewsModule` are still empty backend shells.
- Notifications are now a real API module and frontend page.

## Documentation Index

- [ARCHITECTURE.md](./ARCHITECTURE.md): system shape, core flows, and danger zones
- [ENVIRONMENT.md](./ENVIRONMENT.md): env vars, local services, and config mismatches
- [TESTING.md](./TESTING.md): validated command status as of April 10, 2026
- [DEPLOYMENT.md](./DEPLOYMENT.md): what is and is not encoded in the repo for deployment
- [CONTRIBUTING.md](./CONTRIBUTING.md): repo-specific contribution guidance
- [AGENT_GUIDE.md](./AGENT_GUIDE.md): operating instructions for coding agents
- [WORKFLOW.md](./WORKFLOW.md): suggested change workflow for this repo
- [PROJECT_GAP_REPORT.md](./PROJECT_GAP_REPORT.md): remaining product and platform gaps from this audit
- [apps/web/README.md](./apps/web/README.md): frontend-specific guide
- [apps/api/README.md](./apps/api/README.md): backend-specific guide

## Known Repository Quirks

- The root `tsconfig.json` still extends Expo config even though there is no active mobile workspace.
- `packages/shared` breaks the root type-check because of NodeNext export-path rules.
- `apps/web` type generation can be order-sensitive on a fresh checkout.
- Upload env names in `apps/api/.env.example` do not match the names used by `UploadsService`.
- The repo does not contain a checked-in production deployment manifest such as `railway.json` or `vercel.json`.
