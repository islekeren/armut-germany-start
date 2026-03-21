# Deployment

## What Is Actually Present

Observed deployment-related assets in the repository:

- `.github/workflows/ci.yml`
- `docker-compose.yml`

Observed missing assets as of 2026-03-21:

- no `railway.json`
- no `vercel.json`
- no `Dockerfile`
- no Terraform, Pulumi, or Kubernetes manifests

## CI Pipeline

Observed in `.github/workflows/ci.yml`:

1. lint
2. API tests
3. web build
4. API build
5. e2e tests
6. deploy staging placeholder
7. deploy production placeholder

Observed deploy jobs:

- staging and production jobs only run `echo` placeholders
- no real deployment command is checked in

Practical meaning:

- CI exists
- actual deployment automation does not

## Runtime Assumptions Visible In Code

Observed:

- API expects PostgreSQL
- API can expose Swagger docs
- uploads expect S3-compatible storage
- web expects an API origin via env vars

Unknown:

- production hosting provider for the web app
- production hosting provider for the API
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

1. inspect the current workflow file
2. inspect actual hosting manifests in the repo
3. if no manifest exists, report that explicitly
4. ask for target platform confirmation before creating or changing deployment files

## What Needs Human Confirmation

- target hosting platform
- deployment topology for web and API
- migration strategy
- secret management strategy
- whether Playwright and deploy placeholders are roadmap items or stale remnants

## Practical Recommendation

Treat deployment work in this repository as a high-clarity task that requires explicit human confirmation before execution.

Until that confirmation exists, focus on local runtime correctness and CI accuracy instead of guessing production infrastructure.
