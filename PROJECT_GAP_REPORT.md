# Project Gap Report

Observed and updated on April 10, 2026.

## Scope

This is not a full product audit.

It is a repo-grounded gap report based on:

- current routes in `apps/web`
- current modules in `apps/api`
- current validation results
- current config and workflow files

## Current Snapshot

- the web app has broad route coverage for customer and provider flows
- the API now includes notifications and passes unit and e2e tests
- root lint and build are green
- the biggest remaining repo-wide tooling issue is the root type-check failure from `packages/shared`

## Active Gaps

### 1. Validation and tooling gaps

- Root `npm run check-types` still fails because `packages/shared` uses extensionless exports under NodeNext.
- Web `npm run check-types` can still be order-sensitive on a fresh checkout until `.next/types/cache-life.d.ts` exists.
- API lint still passes with 15 warnings instead of a clean warning-free baseline.

### 2. Product and UX gaps

- Public routes like `/help`, `/pricing`, `/success-stories`, `/privacy`, and `/terms` currently resolve to a generic coming-soon page instead of final content.
- Provider `services` and `finances` pages exist, but they still render placeholder content.
- Quote acceptance still requires an explicit follow-up booking creation step.
- Messaging has a realtime backend gateway, but the current frontend experience is still primarily REST-driven.

### 3. Backend domain gaps

- `ServicesModule` is still an empty shell.
- `ReviewsModule` is still an empty shell.
- A `Payment` model exists in Prisma, but there is still no payments controller or service module.

### 4. Platform and configuration gaps

- Upload env names are inconsistent between `apps/api/.env.example` and `UploadsService`.
- The repo has no checked-in real deployment manifest such as `railway.json` or `vercel.json`.
- GitHub Actions deploy jobs are placeholders only.
- `apps/mobile` is still dormant scaffolding rather than a real workspace.
- the root `tsconfig.json` still extends Expo config even though the mobile workspace is not active.

### 5. Shared-package gaps

- `packages/shared` exists but is not serving as a stable, integrated contract layer yet.
- `packages/ui` exists, but the actual app UI still lives in `apps/web/components`.

## Suggested Priority Order

### P0

- Fix `packages/shared` export paths so root type-check becomes a trustworthy gate.
- Reconcile upload env names between code and example config.

### P1

- Decide whether placeholder public pages should stay as coming-soon routes or become real content pages.
- Replace provider `services` and `finances` placeholders with real product flows or relabel them more explicitly as beta.
- Decide whether the explicit quote-to-booking handoff is the intended product behavior.

### P2

- Decide whether to formalize deployment config in-repo or document the external release process properly.
- Decide whether to keep or remove dormant mobile scaffolding.
- Decide whether `packages/shared` and `packages/ui` should become real integration points or stay scaffold-only.

## Recommended Use Of This File

Use this report as a planning aid, not as a promise that every other area of the product has been exhaustively reviewed.

If you close one of these gaps, update this file along with the relevant technical docs so the repo stays self-describing.
