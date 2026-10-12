# Release and deployment

Updated October 12, 2026. The selected topology is **Railway API + Vercel web**, confirmed by the project owner. `main` is the canonical integration and release source. These platform selections are confirmed; the hosted project IDs, domains, credentials and dashboard settings have not been inspected through this checkout.

## Hosting configuration

| Component | Source and working directory | Build / start | Release checks |
| --- | --- | --- | --- |
| Railway API | This repository, `main`, repository root, `railway.json` | Prisma generation and API build; `npm run start:prod --workspace=api` | `/api/health/ready` must return 200 with database up |
| Vercel web | This repository, production branch `main`, Root Directory `apps/web`, `apps/web/vercel.json`; enable access to files outside the root | `npm ci --prefix ../..`, then `npm run build` (Next.js) | Homepage and `/release`; the commit must match the API |
| Database | Railway PostgreSQL or the configured PostgreSQL host | API pre-deploy owns `prisma migrate deploy` | Backups, restore rehearsal and migration compatibility |
| Object storage | Existing S3-compatible bucket configured on the API | No provisioning or demo seeding during releases | Confirm upload/read/delete with a staging fixture |

`render.yaml` is a historical alternative; automatic deployment is disabled in that file. It is not the selected API path. The root Dockerfile remains a scaffold and is not the production runtime path.

Both components must be deployed for every release SHA, including a change that affects only one app. Railway has no API-only watch filter, and Vercel uses an explicit ignored-build command that continues builds. Disable any dashboard option that skips unchanged projects; otherwise one component may retain a previous commit and the verifier will correctly reject the release.

In Railway, verify the connected repository, `main` branch, config path `/railway.json`, environment and healthcheck. Enable its CI wait gate where available; otherwise deploy the exact passing main commit manually. In Vercel, verify Root Directory, production branch and workspace access. Do not automatically promote production before main CI has passed: use a configured deployment gate or manual deployment/promotion of the tested commit. A Git integration alone does not establish a CI gate. Disable any old duplicate host or deployment-branch automatic release trigger before enabling the selected path.

The repository's workflows deliberately **do not publish** to Railway or Vercel. Misleading placeholder deploy jobs have been removed. Hosting permissions are separate from the repository changes; a successful verification is not a deployment.

## Main protection and the compatibility mirror

Every change must arrive through a reviewed PR. Required checks are `Lint`, `Type Check`, `Test API`, `Test Web`, `Build API`, `E2E (API)` and `E2E (Web)`. PRs run browser smoke tests; pushes to main run the full browser suite. Require the branch to be up to date, one approving review, dismissal of stale approvals, resolved conversations and no force pushes or deletion.

The intended GitHub policy is versioned in `.github/main-branch-protection.json`. An administrator can apply it with an authenticated GitHub CLI:

```bash
gh api --method PUT repos/islekeren/armut-germany-start/branches/main/protection \
  --input .github/main-branch-protection.json
```

Verify the required checks and rules in GitHub after applying it. The current app connection returned `403 Resource not accessible by integration` when reading main protection; this file is a reviewable policy, **not evidence that protection was applied**.

`.github/workflows/mirror-deployment.yml` runs only after a successful **push CI** on main. `scripts/mirror-deployment.sh` fetches current heads, rejects divergence, skips stale runs and uses a normal fast-forward push. `deployment` receives no feature commits and is a compatibility mirror, not a second release source. The workflow needs repository Contents write permission; configure that explicitly if organization policy blocks it. Vercel deployment from this mirror is disabled in its manifest. Do not force-reset a divergent mirror: investigate its extra commits first.

## Environment and migration ownership

API production configuration:

- `NODE_ENV=production`, `DATABASE_URL`, independent strong `JWT_SECRET` / `JWT_REFRESH_SECRET`;
- `CORS_ORIGINS` containing approved web origins only (including deliberately allowed staging origins);
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` when uploads are enabled;
- Stripe configuration only once the payment branch is reviewed and merged;
- Railway provides `PORT` and `RAILWAY_GIT_COMMIT_SHA`; alternatively set `APP_COMMIT_SHA` to the exact full release commit.

Vercel configuration:

- `API_URL` for server-side calls and rewrites; `NEXT_PUBLIC_API_URL` for direct browser uploads/API calls;
- configure separate Preview and Production values; public variables never contain secrets;
- Vercel provides `VERCEL_GIT_COMMIT_SHA`; alternatively set `APP_COMMIT_SHA` to the exact full release commit.

The API alone owns migrations, once per release in Railway pre-deploy. The web build never applies migrations. `railway.json` never seeds; the demo seed rejects any runtime except explicit development/test. Existing taxonomy migrations supply production categories. Verify the hosted database contains no accounts left by historical demo seeds, including known test admin credentials. This change does not inspect or remove hosted data.

Use additive migrations compatible with both old and new application versions. Destructive schema changes require a separate migration and recovery plan; do not rely on application rollback to undo database changes.

## Staging and release verification

Use a separate Railway staging environment/database/bucket and Vercel Preview environment; never point a preview or test seed at production. Set staging CORS to the preview origins and isolate any Stripe test credentials. Staging resources and domains still need to be configured in the hosting dashboards.

Release checklist:

1. Merge a reviewed PR to main and wait for its complete push CI, including full Playwright tests.
2. Record the full main commit, previous healthy commit, backup/snapshot and migration compatibility decision.
3. Deploy that exact commit to Railway staging and Vercel Preview; check request → quote → booking, messages, provider onboarding and upload failures. Include payment/refund/dispute paths once Stripe is merged.
4. Deploy/promote that same tested commit to Railway production and Vercel production using the selected platform gate. Confirm migration success, database readiness and approved CORS.
5. Verify both running commit IDs and availability:

```bash
node scripts/verify-release.mjs FULL_40_CHARACTER_COMMIT_SHA \
  https://YOUR_API_ORIGIN https://YOUR_WEB_ORIGIN
```

The verifier rejects a dead/unready database, stale API/web commits, redirects, credential-bearing URLs and unreachable services. Every request has a deadline. `/api/health` is liveness; `/api/health/ready` is database readiness; `/release` exposes only the web commit. Unknown commit metadata fails release verification.

Alternatively run **Verify running release** in GitHub Actions. Set `PRODUCTION_API_URL` and `PRODUCTION_WEB_URL` as production-environment variables, configure environment reviewers, and supply the full deployed main SHA. The workflow verifies a successful push CI exists for that main commit before checking the two hosts. It does not deploy or migrate.

6. Check correlated runtime/client-error logs and repeat the critical production smoke flow with dedicated operational fixtures. Record host deployment IDs and the successful verification result.

## Rollback and recovery

1. Stop further releases; record the failing deployment IDs, commit and affected routes/request IDs.
2. Confirm the previous application version is compatible with the current database schema.
3. Redeploy/promote the previously healthy commit on **both** Railway and Vercel. Preserve production secrets and storage settings. A platform rollback must not re-run demo seeds.
4. Run the same release verifier with the previous full SHA and repeat smoke checks.
5. If schema rollback is necessary, restore a tested snapshot through a separately reviewed database recovery procedure. Do not run `migrate reset` or demo seed on a hosted production database.

Before beta, enable database backups/PITR supported by the selected host and rehearse restoring to a separate database. Backup retention and an actual restore result cannot be inferred from repository files.

See [OBSERVABILITY.md](./OBSERVABILITY.md) for logs, readiness semantics and incident triage; [ENVIRONMENT.md](./ENVIRONMENT.md) for the variable inventory.
