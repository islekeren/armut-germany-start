# Deployment

Audited against the repository on April 10, 2026.

## What The Repository Actually Contains

Checked-in deployment-related assets:

- `.github/workflows/ci.yml`
- `docker-compose.yml`

Not present in the repository:

- `railway.json`
- `vercel.json`
- `Dockerfile`
- Terraform, Pulumi, Helm, or Kubernetes manifests

Practical meaning:

- the repo does not encode a complete production deployment story
- if the team is deploying through platform dashboards or another branch strategy, that knowledge is currently outside the repo

## CI Workflow

Observed in `.github/workflows/ci.yml`:

- triggers on pushes and pull requests to `main` and `develop`
- uses Node `20.x`
- runs these jobs in sequence:
  - `lint`
  - `test-api`
  - `test-web`
  - `build-api`
  - `e2e-tests`
  - `deploy-staging`
  - `deploy-production`

### CI job details

- `test-api` provisions Postgres 15 and Redis 7, runs Prisma generate and migrate deploy, then runs API unit tests with coverage
- `test-web` runs `npm run test --if-present` in `apps/web` and then `npm run build`
- `e2e-tests` runs API e2e tests and conditionally runs Playwright only if a Playwright config and tests are present in `apps/web`

### Deploy jobs

The deploy jobs are placeholders:

- `deploy-staging` runs only on `develop`
- `deploy-production` runs only on `main`
- both jobs currently just `echo` deployment text and do not perform a real release

Practical meaning:

- GitHub Actions is a real CI pipeline
- GitHub Actions is not a real deployment pipeline yet

## What A Real Deployment Would Need

### Backend requirements

From current code, the API needs:

- PostgreSQL
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- optional `PORT`
- S3-compatible storage config if uploads are used

Nice-to-know:

- Redis is provisioned in CI and local docker compose, but runtime cache is currently in memory
- Swagger is available at `/api/docs`

### Frontend requirements

From current code, the web app needs:

- `API_URL`
- `NEXT_PUBLIC_API_URL`

Optional:

- `API_TIMEOUT_MS`
- `NEXT_PUBLIC_API_TIMEOUT_MS`

## What The Repo Cannot Tell You Yet

The repository alone does not confirm:

- which hosting provider serves production
- which branch is the real deployment branch
- how production secrets are managed
- where database migrations run in production
- whether deployment config lives in Vercel, Railway, another platform, or manual steps

Avoid writing docs or automation that pretend those details are known unless they are added to the repo or confirmed separately.

## Safe Change Guidance

If a task affects deployment:

1. inspect `.github/workflows/ci.yml`
2. confirm whether the work is only CI, only app code, or true deployment config
3. do not invent `vercel.json`, `railway.json`, or branch-based deployment rules without explicit confirmation
4. update this document when deployment knowledge becomes repo-visible

## Recommended Next Documentation Step

If the team has a real production setup outside this repo, document it explicitly in one of these ways:

- add checked-in platform config where possible
- add a private/internal runbook that is referenced from this repo
- replace the placeholder GitHub Actions deploy jobs with the actual release path
