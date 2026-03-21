# Environment

## Local Services

Observed local infrastructure in `docker-compose.yml`:

- PostgreSQL 16 on `localhost:5432`
- Redis 7 on `localhost:6379`

Start them with:

```bash
docker compose up -d postgres redis
```

## API Environment

Expected local file:

- `apps/api/.env`

Bootstrap from:

```bash
cp apps/api/.env.example apps/api/.env
```

### API Variables

| Variable             | Status                       | Purpose                                                                           |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Required                     | Prisma database connection                                                        |
| `JWT_SECRET`         | Required                     | access token signing                                                              |
| `JWT_REFRESH_SECRET` | Required                     | refresh token signing                                                             |
| `PORT`               | Optional                     | Nest port, defaults to `4000`                                                     |
| `NODE_ENV`           | Optional                     | runtime mode                                                                      |
| `CORS_ORIGINS`       | Optional but recommended     | allowed origins for API requests                                                  |
| `RATE_LIMIT_DEFAULT` | Optional                     | throttling limit                                                                  |
| `RATE_LIMIT_STRICT`  | Documented, not clearly used | example file includes it, but current throttle module only reads default limit    |
| `RATE_LIMIT_RELAXED` | Documented, not clearly used | example file includes it, but current throttle module only reads default limit    |
| `REDIS_URL`          | Documented, weakly used      | compose and CI provide Redis, but current cache module still uses in-memory cache |

### Upload Variables

Observed in code:

- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_URL`

Observed in `apps/api/.env.example`:

- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`

Needs confirmation:

- The checked-in env example does not match the checked-in uploads service code.
- If you work on uploads, resolve this mismatch before treating env documentation as authoritative.

### Optional Or Not Fully Wired API Variables

Observed in env example but not clearly active in code:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SENDGRID_API_KEY`
- `EMAIL_FROM`
- `MEILISEARCH_HOST`
- `MEILISEARCH_API_KEY`
- `GOOGLE_MAPS_API_KEY`

Observed repository state:

- payment schema exists, but no payment module/controller was found
- sendgrid vars exist, but no email flow was found
- meilisearch dependency exists, but no search module was found
- maps key exists, but request creation still sends `lat` and `lng` as `0`

## Web Environment

Expected local file:

- `apps/web/.env.local`

Bootstrap from:

```bash
cp apps/web/.env.example apps/web/.env.local
```

### Web Variables

| Variable              | Status                                           | Purpose                                    |
| --------------------- | ------------------------------------------------ | ------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | Required for browser requests and rewrite target | frontend-visible API base origin           |
| `API_URL`             | Required for server-side requests                | server-side API origin used by the web app |

Recommended local values:

```bash
API_URL="http://localhost:4000"
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Observed behavior:

- `apps/web/next.config.js` rewrites `/api/:path*` to `NEXT_PUBLIC_API_URL`.
- `apps/web/lib/api.ts` attempts to build URLs for both server and client usage.

Important:

- The current web build is broken because `apps/web/lib/api.ts` references `API_URL` as a variable instead of calling the helper that resolves it.

## Database Setup

Run from `apps/api`:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Observed seed outputs:

- categories
- provider and customer test users
- sample providers
- sample requests, quotes, bookings, reviews, and conversations

## CORS

Observed API behavior:

- `apps/api/src/main.ts` reads `CORS_ORIGINS`
- default fallback allows `http://localhost:3000` and `http://localhost:8081`

Observed mismatch:

- No mobile workspace exists, but `8081` remains in the default origin list

Needs confirmation:

- whether mobile support is planned or this is stale config

## Do Not Commit

- `apps/api/.env`
- `apps/web/.env.local`
- real secrets for uploads, JWT, Stripe, email, or search providers

## Environment Setup Checklist

1. Copy `apps/api/.env.example` to `apps/api/.env`
2. Copy `apps/web/.env.example` to `apps/web/.env.local`
3. Start Postgres and Redis
4. Run Prisma generate, migrate, and seed
5. Start the API and web apps
6. Verify Swagger and homepage load locally
