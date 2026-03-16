# Deployment Guide

## Runtime

- Node.js: `20.9.0` or newer
- Web: Vercel
- API: Railway
- Database: PostgreSQL (Railway Postgres, Neon, Supabase, or equivalent)

## Web on Vercel

### Project settings

- Framework Preset: `Next.js`
- Root Directory: `apps/web`
- Install Command: leave default if Vercel detects the monorepo correctly, otherwise use `npm ci`
- Build Command: `npm run build`

### Required environment variables

- `API_URL=https://your-api-service.up.railway.app`
- `NEXT_PUBLIC_API_URL=https://your-api-service.up.railway.app`

`API_URL` is used for server-side rendering and the Vercel rewrite. `NEXT_PUBLIC_API_URL` is still needed for direct browser upload requests so large files do not have to pass through the Vercel proxy.

## API on Railway

### Project settings

- Deploy from GitHub repo
- Service path/config: [`apps/api/railway.json`](/Users/eren/Desktop/ARMUT/armut-germany-start/apps/api/railway.json#L1)
- Build Command: `npm run db:generate --workspace=api && npm run build --workspace=api`
- Pre-Deploy Command: `npm run db:migrate:deploy --workspace=api`
- Start Command: `npm run start:prod --workspace=api`
- Health Check Path: `/api/health`

For this repo, keep the service source at the repository root. This is a shared npm workspaces monorepo, so the API service should build from the root and use workspace-specific commands.

### Required environment variables

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS=https://your-web-domain.vercel.app`

`DATABASE_URL` stays the same in every environment. The only difference is the value:

- Local development: your Docker Postgres URL, for example `postgresql://armut:armut123@localhost:5432/armut_db?schema=public`
- Production: your managed Postgres URL from Railway Postgres, Neon, Supabase, Render Postgres, etc.

Production should not run Postgres in Docker for this app. The API already reads Prisma config from `DATABASE_URL`, so no code change or separate Prisma setup is required beyond setting the hosted connection string.

If you create a Railway PostgreSQL service in the same project, set:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`

`Postgres` is the default service namespace if the database service is named `Postgres`. If you rename the database service, update the namespace accordingly.

### Common optional environment variables

- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_URL`
- `REDIS_URL`
- `MEILISEARCH_HOST`
- `MEILISEARCH_API_KEY`
- `GOOGLE_MAPS_API_KEY`

If you want Vercel preview deployments to call the API directly for uploads, `CORS_ORIGINS` also accepts `*` wildcards, for example `https://your-preview-domain-*.vercel.app`.

## Deployment order

1. Create the Railway PostgreSQL service in the same Railway project.
2. Set `DATABASE_URL=${{Postgres.DATABASE_URL}}` and the other API env vars on the Railway API service.
3. Deploy the API to Railway and confirm `https://your-api-service.up.railway.app/api/health` returns `{"status":"ok",...}`.
4. Set both web env vars in Vercel to the Railway API origin.
5. Deploy the web app to Vercel.
6. Update the API `CORS_ORIGINS` value with your final Vercel production domain and redeploy the API if needed.

## Notes

- The Next.js app now fetches API data dynamically on the server, so Vercel builds do not depend on the API being live.
- Browser uploads are sent directly to the API origin when `NEXT_PUBLIC_API_URL` is set.
- The API now trusts the proxy and binds to `0.0.0.0`, which is the expected setup on Railway.
- `docker-compose.yml` is for local development only. Production uses external services with the same env variable names.
