# Environment

Audited against the repository on April 10, 2026.

## Local Services

`docker-compose.yml` provides:

- PostgreSQL 16 on `localhost:5432`
- Redis 7 on `localhost:6379`

Start them with:

```bash
docker compose up -d postgres redis
```

## Recommended Local Baseline

- Node.js 20.x is the safest local baseline because that is what CI uses
- npm workspaces are the active package manager model
- the root project declares `npm@10.9.2`

## API Environment

Expected local file:

- `apps/api/.env`

Bootstrap from:

```bash
cp apps/api/.env.example apps/api/.env
```

### API variables actively used in code

| Variable | Status | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Required | Prisma datasource |
| `JWT_SECRET` | Required | access token signing |
| `JWT_REFRESH_SECRET` | Required | refresh token signing |
| `PORT` | Optional | defaults to `4000` |
| `NODE_ENV` | Optional | runtime mode |
| `CORS_ORIGINS` | Optional | comma-separated allowlist read in `apps/api/src/main.ts` |
| `RATE_LIMIT_DEFAULT` | Optional | only throttler setting currently wired |
| `S3_ENDPOINT` | Required for uploads | S3 or R2 endpoint |
| `S3_BUCKET` | Required for uploads | object storage bucket |
| `S3_REGION` | Optional for uploads | defaults to `auto` |
| `S3_ACCESS_KEY_ID` | Required for uploads | used by `UploadsService` |
| `S3_SECRET_ACCESS_KEY` | Required for uploads | used by `UploadsService` |
| `S3_PUBLIC_URL` | Optional for uploads | used to build public URLs |

### API variables present in `.env.example` but not wired as written

| Variable | Status | Notes |
| --- | --- | --- |
| `JWT_EXPIRES_IN` | Example only | current auth code uses hardcoded token lifetimes |
| `JWT_REFRESH_EXPIRES_IN` | Example only | current auth code uses hardcoded token lifetimes |
| `RATE_LIMIT_STRICT` | Example only | not read by current throttle module |
| `RATE_LIMIT_RELAXED` | Example only | not read by current throttle module |
| `REDIS_URL` | Example only | cache is currently configured in memory |
| `STRIPE_SECRET_KEY` | Example only | no payments module was found |
| `STRIPE_WEBHOOK_SECRET` | Example only | no payments module was found |
| `SENDGRID_API_KEY` | Example only | no email integration was found |
| `EMAIL_FROM` | Example only | no email integration was found |
| `MEILISEARCH_HOST` | Example only | no active search module was found |
| `MEILISEARCH_API_KEY` | Example only | no active search module was found |
| `GOOGLE_MAPS_API_KEY` | Example only | no active Google Maps integration was found |

### Upload env mismatch to know about

`apps/api/.env.example` currently documents:

- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`

But `apps/api/src/modules/uploads/uploads.service.ts` currently expects:

- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

If uploads stop working, check this mismatch first.

## Web Environment

Expected local file:

- `apps/web/.env.local`

Bootstrap from:

```bash
cp apps/web/.env.example apps/web/.env.local
```

### Web variables

| Variable | Status | Notes |
| --- | --- | --- |
| `API_URL` | Recommended | server-side API origin used by `apps/web/lib/api.ts` |
| `NEXT_PUBLIC_API_URL` | Recommended | browser-side API origin and rewrite target |
| `API_TIMEOUT_MS` | Optional | server-side API timeout override |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | Optional | client-side API timeout override |

Recommended local values:

```bash
API_URL="http://localhost:4000"
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Observed behavior:

- `apps/web/next.config.js` rewrites `/api/:path*` to `NEXT_PUBLIC_API_URL` with a localhost fallback
- `apps/web/lib/api.ts` uses `API_URL` for server requests and `NEXT_PUBLIC_API_URL` for direct browser requests
- `turbo.json` tracks `API_URL`, `NEXT_PUBLIC_API_URL`, `API_TIMEOUT_MS`, `NEXT_PUBLIC_API_TIMEOUT_MS`, and `NODE_ENV` as global env inputs

### Web type-generation caveat

`apps/web/tsconfig.json` includes `.next/types/**/*.ts`.

Observed on April 10, 2026:

- `npm run check-types` initially failed on a fresh state because `.next/types/cache-life.d.ts` was missing
- after running `npm run build`, `npm run check-types` passed in this workspace

If web type-checking fails with a missing `.next/types` file, run a build once and retry.

## Mobile Stub

Observed in the repo:

- `apps/mobile/.env`
- `apps/mobile/.expo`
- `apps/mobile/expo-env.d.ts`

Important:

- there is no `apps/mobile/package.json`
- the mobile folder is not an active npm workspace
- there is no mobile `.env.example`

Treat `apps/mobile` as dormant scaffolding unless the workspace is formalized.

## Database Setup

From `apps/api`:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

The seed script creates:

- request taxonomy categories
- provider and customer test accounts
- additional providers
- sample requests
- sample quotes
- sample bookings
- reviews

## CORS

Observed in `apps/api/src/main.ts`:

- `CORS_ORIGINS` is split by commas when provided
- default fallback allows `http://localhost:3000` and `http://localhost:8081`

Repo-specific note:

- `8081` appears to be a leftover mobile-oriented default even though the mobile workspace is dormant

## Setup Checklist

1. Copy `apps/api/.env.example` to `apps/api/.env`
2. Copy `apps/web/.env.example` to `apps/web/.env.local`
3. Start Postgres and Redis
4. Run Prisma generate, migrate, and seed in `apps/api`
5. Start the repo with `npm run dev`
6. Verify `http://localhost:3000` and `http://localhost:4000/api/docs`
