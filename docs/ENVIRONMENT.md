# Environment

Audited against the current checkout on September 11, 2026.

## Local Services

`docker-compose.yml` provides:

- PostgreSQL 16 on `localhost:5432`
- Redis 7 on `localhost:6379`

Start them with:

```bash
docker compose up -d postgres redis
```

## Recommended Local Baseline

- Node.js `>=20.9.0` is required by the root and active app manifests; CI uses Node 20.x
- npm workspaces are the active package manager model
- the root project declares `npm@10.9.2`

## Release identity

Production API uses Railway and the web uses Vercel. Railway injects `RAILWAY_GIT_COMMIT_SHA`; Vercel injects `VERCEL_GIT_COMMIT_SHA`. `APP_COMMIT_SHA` is a fallback for a manual deployment and must be the exact full 40-character commit. Missing/invalid metadata is reported as `unknown`, so release verification fails rather than claiming the wrong version. These values contain no credentials. See [DEPLOYMENT.md](./DEPLOYMENT.md) for host directory, CI gates and rollout checks.

## API Environment

Expected local file:

- `apps/api/.env`

Bootstrap from:

```bash
cp apps/api/.env.example apps/api/.env
```

### API variables actively used in code

| Variable                      | Status                                      | Notes                                                                                     |
| ----------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | Required                                    | Prisma datasource                                                                         |
| `JWT_SECRET`                  | Required                                    | access token signing                                                                      |
| `JWT_REFRESH_SECRET`          | Required                                    | refresh token signing                                                                     |
| `PORT`                        | Optional                                    | defaults to `4000`                                                                        |
| `NODE_ENV`                    | Explicit for development/test               | other values use strict authentication validation                                                                              |
| `CORS_ORIGINS`                | Optional                                    | comma-separated allowlist shared by HTTP and messaging sockets                             |
| `RATE_LIMIT_DEFAULT`          | Optional                                    | only throttler setting currently wired                                                    |
| `THROTTLE_DISABLED`           | Test only                                   | `true` skips rate limiting, but only when `NODE_ENV=test`; set by the Playwright config   |
| `S3_ENDPOINT`                 | Required for uploads                        | S3 or R2 endpoint                                                                         |
| `S3_BUCKET`                   | Required for uploads                        | object storage bucket                                                                     |
| `S3_REGION`                   | Optional for uploads                        | defaults to `auto`                                                                        |
| `S3_ACCESS_KEY_ID`            | Required for uploads                        | used by `UploadsService`                                                                  |
| `S3_SECRET_ACCESS_KEY`        | Required for uploads                        | used by `UploadsService`                                                                  |
| `S3_PUBLIC_URL`               | Optional for uploads                        | used to build public URLs                                                                 |
| `S3_FORCE_PATH_STYLE`         | Optional for uploads                        | `true` for MinIO or S3 mocks that need path-style bucket URLs; the e2e suite sets it      |
| `STRIPE_SECRET_KEY`           | Required for payments in the feature branch | prefer a least-privilege `rk_test_` key; `sk_test_` is accepted for initial sandbox setup |
| `STRIPE_WEBHOOK_SECRET`       | Required for payments in the feature branch | Stripe CLI or Dashboard endpoint signing secret                                           |
| `STRIPE_CONNECT_RETURN_URL`   | Required for payments in the feature branch | hosted onboarding completion URL                                                          |
| `STRIPE_CONNECT_REFRESH_URL`  | Required for payments in the feature branch | expired onboarding-link recovery URL                                                      |
| `STRIPE_CHECKOUT_SUCCESS_URL` | Required for payments in the feature branch | must contain `{bookingId}`                                                                |
| `STRIPE_CHECKOUT_CANCEL_URL`  | Required for payments in the feature branch | must contain `{bookingId}`                                                                |
| `PLATFORM_COMMISSION_RATE`    | Optional for payments in the feature branch | defaults to `0.15`; must be between 0 and 1                                               |

Authentication configuration is validated before the API starts. Both JWT secrets are required in every environment and must have no surrounding whitespace. Unless `NODE_ENV` is explicitly `development` or `test`, the secrets must differ and each must be at least 32 characters; common placeholder prefixes and repeated-character values are rejected. Generate independent random secrets and store them in the hosting secret manager. There are no built-in fallback secrets.

For rotation, generate new independent values, update every API instance together, and restart them so HTTP and sockets use the same keys. This implementation has no overlapping key grace period: rotating the access key invalidates existing access tokens; rotating the refresh key invalidates existing refresh tokens. Clients whose tokens are invalidated must sign in again. Use coordinated rotation of both keys when invalidating all existing JWT sessions.

See [STRIPE_SANDBOX.md](./STRIPE_SANDBOX.md) for the local Connect onboarding, webhook, payment, and delayed-transfer test flow.

These payment variables describe the current `codex/stripe-connect-payments` checkout. The payment implementation has not yet been merged into `origin/main`, so production configuration should follow only after that branch is synchronized, reviewed, validated, and merged.

### API variables present in `.env.example` but not wired as written

| Variable                 | Status       | Notes                                            |
| ------------------------ | ------------ | ------------------------------------------------ |
| `JWT_EXPIRES_IN`         | Example only | current auth code uses hardcoded token lifetimes |
| `JWT_REFRESH_EXPIRES_IN` | Example only | current auth code uses hardcoded token lifetimes |
| `RATE_LIMIT_STRICT`      | Example only | not read by current throttle module              |
| `RATE_LIMIT_RELAXED`     | Example only | not read by current throttle module              |
| `REDIS_URL`              | Example only | cache is currently configured in memory          |
| `SENDGRID_API_KEY`       | Example only | no email integration was found                   |
| `EMAIL_FROM`             | Example only | no email integration was found                   |
| `MEILISEARCH_HOST`       | Example only | no active search module was found                |
| `MEILISEARCH_API_KEY`    | Example only | no active search module was found                |
| `GOOGLE_MAPS_API_KEY`    | Example only | no active Google Maps integration was found      |

### Upload env alignment

`apps/api/.env.example` and `UploadsService` now use the same credential names:

- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

This resolves the previous example/code mismatch. Existing external environments that still use `S3_ACCESS_KEY` or `S3_SECRET_KEY` must be migrated to the current names.

## Web Environment

Expected local file:

- `apps/web/.env.local`

Bootstrap from:

```bash
cp apps/web/.env.example apps/web/.env.local
```

### Web variables

| Variable                     | Status      | Notes                                                |
| ---------------------------- | ----------- | ---------------------------------------------------- |
| `API_URL`                    | Recommended | server-side API origin used by `apps/web/lib/api.ts` |
| `NEXT_PUBLIC_API_URL`        | Recommended | browser-side API origin and rewrite target           |
| `API_TIMEOUT_MS`             | Optional    | server-side API timeout override                     |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | Optional    | client-side API timeout override                     |

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

The current web `check-types` command runs `next typegen` before `tsc --noEmit`, and it passes in this checkout. If a fresh checkout reports missing `.next/types` files, inspect stale generated state and preserve the exact error rather than assuming that build-first is an architectural requirement.

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
NODE_ENV=development npm run db:seed
```

The demo seed refuses production, staging, unset, or unknown runtimes before database access. The Playwright preparation script explicitly uses `NODE_ENV=test` for its isolated demo seed. Production category data is supplied by existing taxonomy migrations.

The seed script creates:

- request taxonomy categories
- provider and customer test accounts
- additional providers
- sample requests
- sample quotes
- sample bookings
- reviews

## CORS

Observed in `apps/api/src/app.setup.ts`:

- `CORS_ORIGINS` is split by commas when provided
- default fallback allows `http://localhost:3000` and `http://localhost:8081`
- exact origins and wildcard patterns are anchored; both HTTP CORS and WebSocket handshakes use the same policy
- clients without an Origin header still require valid authentication

Repo-specific note:

- `8081` appears to be a leftover mobile-oriented default even though the mobile workspace is dormant

## Setup Checklist

1. Copy `apps/api/.env.example` to `apps/api/.env`
2. Copy `apps/web/.env.example` to `apps/web/.env.local`
3. Start Postgres and Redis
4. Run Prisma generate, migrate, and seed in `apps/api`
5. Start the repo with `npm run dev`
6. Verify `http://localhost:3000` and `http://localhost:4000/api/docs`

### Private uploads

`S3_PRIVATE_BUCKET` must be separate from the public bucket and deny anonymous access. Missing configuration disables private uploads and all presigned uploads. See [UPLOAD_SECURITY.md](./UPLOAD_SECURITY.md) for lifecycle, legacy-object migration, quota and client contract requirements. Apply the UploadAsset migration before rolling out this code.
