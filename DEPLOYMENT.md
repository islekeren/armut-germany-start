# Deployment Guide

## Runtime

- Node.js: `20.9.0` or newer
- Web: Vercel
- API: Render Web Service
- Database: PostgreSQL (Render Postgres, Neon, Supabase, or equivalent)

## Web on Vercel

### Project settings

- Framework Preset: `Next.js`
- Root Directory: `apps/web`
- Install Command: leave default if Vercel detects the monorepo correctly, otherwise use `npm ci`
- Build Command: `npm run build`

### Required environment variables

- `API_URL=https://your-api-service.onrender.com`
- `NEXT_PUBLIC_API_URL=https://your-api-service.onrender.com`

`API_URL` is used for server-side rendering and the Vercel rewrite. `NEXT_PUBLIC_API_URL` is still needed for direct browser upload requests so large files do not have to pass through the Vercel proxy.

## API on Render

### Project settings

- Runtime: `Node`
- Root Directory: `.`
- Build Command: `npm ci && npm run db:generate --workspace=api && npm run build --workspace=api`
- Pre-Deploy Command: `npm run db:migrate:deploy --workspace=api`
- Start Command: `npm run start:prod --workspace=api`
- Health Check Path: `/api/health`

You can import the included [`render.yaml`](/Users/eren/Desktop/ARMUT/armut-germany-start/render.yaml) instead of typing these by hand.

### Required environment variables

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS=https://your-web-domain.vercel.app`

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

1. Create the PostgreSQL database and copy its connection string into Render as `DATABASE_URL`.
2. Deploy the API to Render and confirm `https://your-api-service.onrender.com/api/health` returns `{"status":"ok",...}`.
3. Set both web env vars in Vercel to the Render API origin.
4. Deploy the web app to Vercel.
5. Update the API `CORS_ORIGINS` value with your final Vercel production domain and redeploy the API if needed.

## Notes

- The Next.js app now fetches API data dynamically on the server, so Vercel builds do not depend on the API being live.
- Browser uploads are sent directly to the API origin when `NEXT_PUBLIC_API_URL` is set.
- The API now trusts the proxy and binds to `0.0.0.0`, which is the expected setup on Render.
