# Project Gap Report

Observed and updated on September 11, 2026.

## Scope

This is not a full product audit.

It is a repo-grounded gap report based on:

- current routes in `apps/web`
- current modules in `apps/api`
- current validation results
- current config and workflow files

## Current Snapshot

- the web app has broad route coverage for customer and provider flows
- the API includes notifications and the payment feature branch includes Stripe Connect payments
- root lint, build, type-check, and all 283 unit tests on `main` are green
- API lint still reports 9 warnings
- API e2e was not rerun in this audit because the local Docker daemon was unavailable
- payment work and the latest `origin/main` dashboard fixes are not yet integrated on one canonical branch

## Active Gaps

### 1. Validation and tooling gaps

- Root lint now passes; the previous `prepare-e2e.mjs` Node-global problem is resolved.
- Web type-check now runs `next typegen` before TypeScript and passes in the current checkout.
- API lint still passes with 9 warnings instead of a clean warning-free baseline.
- The root `tsconfig.json` still extends Expo configuration and produces a warning during otherwise passing unit-test runs.
- The latest API e2e and Playwright status needs reconfirmation in a Docker-capable environment before release.

### 2. Product and UX gaps

- Public routes like `/help`, `/pricing`, `/success-stories`, `/privacy`, and `/terms` currently resolve to a generic coming-soon page instead of final content.
- Provider `services` remains a placeholder; `finances` has Stripe Connect test-mode onboarding and Dashboard access in the payment feature branch.
- Quote acceptance still requires an explicit follow-up booking creation step.
- Messaging has a realtime backend gateway, but the current frontend experience is still primarily REST-driven.
- Homepage search and category price/postcode/sort controls are not yet a complete end-to-end search experience.
- Forgot-password remains a coming-soon route; there is no reset-token and email-delivery flow.
- Provider calendar actions such as details, messaging, availability, and appointment creation remain incomplete.

### 3. Backend domain gaps

- `ServicesModule` is still an empty shell.
- `ReviewsModule` is still an empty shell.
- Payment controllers and services exist in the current feature branch but are not yet in `origin/main`.
- Quote acceptance does not check whether the selected provider is eligible to receive Stripe payments.
- Payment return/webhook processing state is not represented clearly enough for the frontend to avoid premature active-payment messaging.
- Booking completion currently waits on the Stripe transfer path, which can exceed the frontend timeout even if Stripe succeeds.
- Request taxonomy invariants are enforced on create but not consistently on update.
- Notification failures can still make otherwise successful domain mutations appear failed.

### 4. Platform and configuration gaps

- Upload env names are now aligned between `apps/api/.env.example` and `UploadsService`.
- `railway.json` and `render.yaml` exist, but the production host and externally selected deployment branch are not confirmed.
- `railway.json` runs `db:seed` during every pre-deploy, which is unsafe for production.
- The checked-in `Dockerfile` is not a complete runnable production image.
- No checked-in frontend deployment config defines the production web release path.
- GitHub Actions deploy jobs are placeholders only.
- `apps/mobile` is still dormant scaffolding rather than a real workspace.
- the root `tsconfig.json` still extends Expo config even though the mobile workspace is not active.
- auth and socket configuration must not rely on fallback JWT secrets in production.

### 5. Shared-package gaps

- `packages/shared` exists but is not serving as a stable, integrated contract layer yet.
- `packages/ui` exists, but the actual app UI still lives in `apps/web/components`.

## Suggested Priority Order

### 0. Establish a canonical branch

- Keep `main` canonical and synchronize `codex/stripe-connect-payments` with `origin/main`.
- Resolve the combined dashboard/payment state and validate it before merging through a pull request.
- Keep `deployment` synchronized as a compatibility mirror of `main`; never integrate feature work there directly.

### 1. Remove production and payment blockers

- Remove automatic production seeding and require strong production JWT secrets.
- Complete Stripe eligibility, webhook-processing state, and transfer-latency reliability work.
- Reconfirm API and Playwright e2e, then merge and release the payment feature.

### 2. Finish beta-critical product surfaces

- Implement forgot-password/reset-email behavior.
- Replace German beta legal and trust placeholders with reviewed content.
- Implement provider service management and resolve service/category request visibility.
- Choose the search baseline, then complete homepage and category filtering.

### 3. Reliability and maintainability

- Align request-update taxonomy validation with create behavior.
- Preserve timeout/abort behavior across token-refresh retries.
- Isolate notification failures from successful domain mutations.
- Move shared request taxonomy/contracts out of direct frontend imports from API source.
- Clean the lint baseline, improve readiness/monitoring, and document the real release path.

### 4. Product follow-through

- Complete review moderation boundaries, provider calendar actions, route consolidation, and frontend realtime messaging.
- Make the native-versus-WebView mobile decision only after the beta web flow is stable.

See [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) for the ordered Linear implementation sequence and release gates.

## Recommended Use Of This File

Use this report as a planning aid, not as a promise that every other area of the product has been exhaustively reviewed.

If you close one of these gaps, update this file along with the relevant technical docs so the repo stays self-describing.
