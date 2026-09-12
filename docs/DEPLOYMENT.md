# Deployment

Audited against the current checkout on September 11, 2026.

## What The Repository Actually Contains

Checked-in deployment-related assets:

- `.github/workflows/ci.yml`: validation plus placeholder staging and production jobs
- `railway.json`: Railway API build, pre-deploy, start, and health-check commands
- `render.yaml`: one Render API web-service definition
- `Dockerfile`: dependency-install and Prisma-generation scaffold
- `docker-compose.yml`: local PostgreSQL and Redis services

Not present:

- a Vercel manifest or another checked-in web-host definition
- infrastructure-as-code for the database, object storage, secrets, or Stripe resources
- Terraform, Pulumi, Helm, or Kubernetes manifests
- a complete production container definition

Practical meaning:

- the repo now contains candidate API deployment configs, but it still does not encode a complete production topology
- the frontend production host and release path remain unspecified in the repository
- external platform settings can override or supplement these files, so the actual provider and deployment branch must be verified in the hosting dashboards

## CI Workflow

Observed in `.github/workflows/ci.yml`:

- triggers on pushes and pull requests to `main` and `develop`
- uses Node `20.x`
- runs lint and type-check first
- runs API and web unit tests
- builds the web and API
- runs API and Playwright e2e tests with a seeded test database
- exposes `deploy-staging` on `develop` and `deploy-production` on `main`

Both deploy jobs remain placeholders. They only print deployment text and do not publish an application.

Practical meaning:

- GitHub Actions is a real validation pipeline
- GitHub Actions is not a real release pipeline
- a green deploy job is not evidence that Railway, Render, Vercel, or another host released the commit

## Checked-in Platform Configs

### Railway

`railway.json` targets the API and currently:

- builds with Railpack
- generates Prisma Client and builds the API
- runs Prisma migrations before deploy
- starts the NestJS production build
- checks `/api/health`
- restarts failed processes up to 10 times

Production blocker:

```text
preDeployCommand = migrate deploy + db:seed
```

Running `db:seed` on every deploy can insert or rewrite development/demo data in a production database. Remove seed from the pre-deploy command before using this config for production. Keep production seeding, backfills, and one-off data migrations as explicit, reviewed operations.

### Render

`render.yaml` defines a single `armut-germany-api` web service. It:

- installs dependencies, generates Prisma Client, and builds the API
- runs migrations before deploy without automatically running the seed
- starts the API and checks `/api/health`
- declares database, JWT, and CORS configuration

It does not define the frontend, database, Redis, object storage, Stripe secrets, or the complete set of optional API integrations. `autoDeploy: true` does not reveal the selected branch from repository state; verify that setting in Render before relying on it.

### Dockerfile

The checked-in `Dockerfile` installs workspace dependencies and runs API Prisma generation. It currently has no application build command, production stage, exposed port, or `CMD`/`ENTRYPOINT`.

Do not treat it as a runnable production image until those pieces and a container health-check path are added and tested.

## Required Runtime Configuration

The API needs at minimum:

- PostgreSQL and `DATABASE_URL`
- strong, independently generated `JWT_SECRET` and `JWT_REFRESH_SECRET`
- `CORS_ORIGINS` matching the deployed frontend
- S3-compatible storage variables if uploads are enabled
- Stripe variables if the payment feature is deployed
- optional `PORT`, depending on the host

The web app needs:

- `API_URL` for server-side calls
- `NEXT_PUBLIC_API_URL` for browser-side calls and rewrites
- optional API timeout overrides

See [ENVIRONMENT.md](./ENVIRONMENT.md) for the variable inventory. Never use example or fallback secrets in production.

## Branch State And Recommended Policy

Current repository state:

- the active payment work is on `codex/stripe-connect-payments`
- the payment feature includes `origin/main`'s dashboard hydration changes and is open as draft PR [#8](https://github.com/islekeren/armut-germany-start/pull/8)
- the payment commits have not been merged into `origin/main`
- `deployment` was fast-forwarded to the current `origin/main` on September 12, 2026, but repository files do not prove that an external host deploys from it

Recommended policy:

1. Use `main` as the canonical integration and release branch.
2. Create short-lived feature and fix branches from an up-to-date `origin/main`.
3. Require pull requests, review, and green checks; do not commit directly to `main`.
4. Keep `codex/stripe-connect-payments` synchronized with `origin/main`, resolve the payment-safety blockers in draft PR [#8](https://github.com/islekeren/armut-germany-start/pull/8), and merge only after the full payment-sensitive validation set passes.
5. Verify the selected production branch in every external hosting dashboard.
6. Keep `deployment` as a compatibility mirror of `main`: never merge feature work into it directly, and fast-forward it only after reviewed changes land on `main`.

The hosting-dashboard check still requires external confirmation. The repository cannot safely assert the current Railway, Render, Vercel, or other host branch.

## Production Readiness Checklist

Before the first production release:

1. remove automatic production seeding from `railway.json`
2. decide which API config is authoritative instead of leaving Railway and Render as equally plausible paths
3. document and configure the frontend host
4. replace placeholder GitHub Actions deploy jobs or remove them to avoid false confidence
5. verify production secrets, CORS, database migrations, S3 access, Stripe webhooks, and health/readiness behavior
6. validate backup and rollback procedures
7. merge payment work into `main` only after its reliability issues and e2e coverage are verified

## Safe Change Guidance

If a task affects deployment:

1. inspect `.github/workflows/ci.yml`, `railway.json`, `render.yaml`, and `Dockerfile`
2. distinguish CI changes from real hosting changes
3. confirm external provider and branch settings before changing branch policy or release triggers
4. keep schema migration and seed operations separate in production
5. update this document whenever deployment knowledge becomes repo-visible
