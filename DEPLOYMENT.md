# Deployment

## Current Deployment Structure

User-confirmed:

- deployments are driven from the `deployment` branch
- frontend is deployed on Vercel
- backend is deployed on Railway

Observed in the repository:

- root `railway.json` exists and targets the API workspace
- there is no `vercel.json`
- `.github/workflows/ci.yml` exists, but its deploy jobs are placeholders for `main` and `develop`
- `docker-compose.yml` exists for local Postgres and Redis, not for production deployment

Practical meaning:

- the actual hosted deployment path is branch-based and external-platform managed
- GitHub Actions is not currently the source of truth for production deployment

## Branch-Based Deployment Flow

User-confirmed deployment flow:

1. changes intended for hosted environments are pushed or merged to the `deployment` branch
2. Vercel deploys the frontend from that branch
3. Railway deploys the backend from that branch

Repository-specific implication:

- `main` is not the deployment branch
- `develop` is not the deployment branch
- if a task affects production deployment behavior, inspect `deployment` branch assumptions first, not just the checked-in GitHub Actions workflow

Practical meaning:

- branch choice is part of the deploy contract in this repo
- a change can be "code-correct" but still miss deployment if it is not integrated through the `deployment` branch workflow

## Frontend Deployment

User-confirmed:

- frontend hosting is Vercel

Observed:

- there is no `vercel.json` in the repository
- `apps/web` is the only frontend app
- `apps/web/next.config.js` rewrites `/api/:path*` using `NEXT_PUBLIC_API_URL`

Practical meaning:

- Vercel project configuration is likely managed in the Vercel dashboard rather than in-repo
- deployment-critical frontend env vars, especially `NEXT_PUBLIC_API_URL` and `API_URL`, must be configured in Vercel

Needs confirmation before changing deployment behavior:

- which branch Vercel is currently configured to watch inside the Vercel project settings
- which root directory Vercel uses for the build
- whether Vercel runs from the monorepo root or directly from `apps/web`

## Backend Deployment

User-confirmed:

- backend hosting is Railway

Observed in `railway.json`:

- Railway uses `RAILPACK`
- build command:

  ```bash
  npm run db:generate --workspace=api && npm run build --workspace=api
  ```

- start command:

  ```bash
  npm run start:prod --workspace=api
  ```

- pre-deploy command:

  ```bash
  npm run db:migrate:deploy --workspace=api && npm run db:seed --workspace=api
  ```

- healthcheck path:

  ```text
  /api/health
  ```

- watch patterns include:
  - `/apps/api/**`
  - `/packages/shared/**`
  - `/package.json`
  - `/package-lock.json`
  - `/turbo.json`
  - `/railway.json`

Observed in backend code:

- `apps/api/src/modules/health/health.module.ts` and `health.controller.ts` exist
- the Railway healthcheck path is backed by real application code

Practical meaning:

- Railway is configured to deploy only the backend-relevant slice of the monorepo
- backend deployments can be affected by changes in `apps/api`, `packages/shared`, root package metadata, Turborepo config, and `railway.json`

## What Is Actually Present In-Repo

Observed deployment-related assets:

- `.github/workflows/ci.yml`
- `railway.json`
- `docker-compose.yml`

Observed missing deployment manifests:

- no `vercel.json`
- no `Dockerfile`
- no Terraform, Pulumi, or Kubernetes manifests

## CI Versus Real Deployment

Observed in `.github/workflows/ci.yml`:

1. lint
2. API tests
3. web build
4. API build
5. e2e tests
6. deploy staging placeholder on `develop`
7. deploy production placeholder on `main`

Observed mismatch:

- the workflow still models `main` and `develop` deploy jobs
- the real deploy branch is `deployment`
- the deploy jobs only run `echo` and do not represent the live Vercel/Railway setup

Practical meaning:

- treat GitHub Actions as CI only
- do not treat `.github/workflows/ci.yml` as the active deployment definition

Observed:

- API expects PostgreSQL
- API exposes `/api/health` for Railway healthchecks
- API can expose Swagger docs
- uploads expect S3-compatible storage
- web expects an API origin via env vars

Known hosting topology:

- frontend: Vercel
- backend: Railway
- deploy branch: `deployment`

Unknown:

- where secrets are managed
- how migrations are applied in production
- whether Redis is required in production or only planned

## Deployment Risks

- The web build is not currently green on repository baseline.
- API e2e tests are stale.
- Some env variables are documented without active code paths.
- Upload env names in code and env example do not match.

These are blockers for trustworthy deployment automation.

## Safe Agent Behavior

Do not invent deployment configuration casually.

If a task asks for deployment work:

1. inspect `railway.json`
2. inspect `.github/workflows/ci.yml`
3. confirm whether the change affects Vercel settings, Railway settings, or only application code
4. treat `deployment` branch behavior as the live deployment path unless the user says otherwise
5. ask for clarification before inventing `vercel.json` or other new deployment manifests

## What Needs Human Confirmation

- migration strategy
- secret management strategy
- whether GitHub Actions deploy placeholders should be rewritten to match the real `deployment` branch flow
- whether Vercel configuration should stay dashboard-managed or be moved into repo configuration later

## Practical Recommendation

Treat deployment work in this repository as branch-aware platform work:

- Vercel is the frontend host
- Railway is the backend host
- `deployment` is the branch that matters for hosted rollout

When updating docs or automation, keep those three facts explicit so future agents do not mistake the placeholder GitHub workflow for the real deployment path.
