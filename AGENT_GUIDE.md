# Agent Guide

Updated for the repository state audited on April 10, 2026.

## Start Here

Before editing:

1. read [README.md](./README.md)
2. read [ARCHITECTURE.md](./ARCHITECTURE.md)
3. read [TESTING.md](./TESTING.md)
4. read [ENVIRONMENT.md](./ENVIRONMENT.md) if the task touches runtime, env, uploads, or local setup
5. read [DEPLOYMENT.md](./DEPLOYMENT.md) if the task touches CI or release behavior
6. inspect the exact code paths involved

Then check the worktree:

```bash
git status --short
```

Do not overwrite unrelated user changes.

## Current Repo Facts You Should Know

- root `npm run lint` passes
- root `npm run build` passes
- root `npm run check-types` fails because `packages/shared` uses NodeNext-incompatible export paths
- API `lint`, `check-types`, `build`, `test -- --watchman=false`, and `test:e2e -- --watchman=false` all pass
- API e2e can fail in a restricted sandbox with `EPERM`; the suite passed outside the sandbox on April 10, 2026
- web `lint` and `build` pass
- web `check-types` passed after `.next/types` existed; on a fresh checkout, build-first may be necessary
- `apps/mobile` is not an active npm workspace even though the folder exists

## What To Read First By Task Type

### Frontend task

Read:

- relevant route file in `apps/web/app/...`
- related components in `apps/web/components/...`
- `apps/web/lib/api.ts` if the page talks to the backend
- `apps/web/messages/en.json`
- `apps/web/messages/de.json`

### Backend task

Read:

- matching controller in `apps/api/src/modules/*`
- matching service in `apps/api/src/modules/*`
- matching DTO
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma` if persistence is involved

### Auth or user-data task

Read:

- `apps/api/src/modules/auth/*`
- `apps/api/src/modules/users/*`
- `apps/api/src/modules/admin/admin.guard.ts`
- `apps/api/src/common/security/*`
- `apps/web/contexts/AuthContext.tsx`

### Messaging or notifications task

Read:

- `apps/api/src/modules/messages/*`
- `apps/api/src/modules/notifications/*`
- `apps/web/components/messages/MessagesWorkspace.tsx`
- relevant pages in `apps/web/app/.../messages/...`
- `apps/web/app/notifications/page.tsx`

## Planning Rules

- plan from code, not from stale docs or assumptions
- prefer the smallest safe change
- trace shared flows before touching auth, schema, quotes, bookings, messaging, uploads, or notifications
- keep docs aligned when the task changes observable behavior

Good plan shape:

1. inspect the local flow
2. edit the smallest relevant files
3. run targeted validation
4. report what changed and any remaining caveats

## Current Danger Zones

Treat these areas as high-risk:

- `apps/web/lib/api.ts`
- `apps/web/contexts/AuthContext.tsx`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/auth/*`
- `apps/api/src/modules/providers/*`
- `apps/api/src/modules/quotes/*`
- `apps/api/src/modules/bookings/*`
- `apps/api/src/modules/messages/*`
- `apps/api/src/modules/uploads/*`
- `apps/api/src/modules/notifications/*`

## Assumptions You Must Not Silently Change

- accepted quotes still require a separate booking-creation step
- API routes live under `/api`
- auth tokens are stored in browser `localStorage`
- the frontend messaging UI is not fully socket-driven yet
- uploads are meant for S3-compatible storage, but env naming is still inconsistent
- the repo does not encode a real production deployment topology

If your task changes any of those, call it out explicitly.

## Validation Rules

Use [TESTING.md](./TESTING.md) as the current source of truth.

Default guidance:

- frontend-only: `cd apps/web && npm run lint && npm run build`
- frontend data-layer or type-sensitive change: add `npm run check-types`
- backend-only: `cd apps/api && npm run lint && npm run check-types && npm run build`
- backend logic change: add `npm run test -- --watchman=false`
- routing or bootstrap change in API: add `npm run test:e2e -- --watchman=false`
- cross-cutting change: `npm run lint && npm run build && npm run check-types`

Environment caveat:

- if API e2e fails with `EPERM` in a restricted sandbox, rerun it outside the sandbox before declaring the suite broken

## When To Ask For Human Clarification

Stop and ask when:

- the task changes auth semantics
- the task changes payment behavior
- the task changes public API contracts used by multiple screens
- a schema change requires guessing business rules
- deployment behavior needs to change beyond the placeholder CI jobs
- the repo and outside-of-repo deployment reality disagree

## When To Avoid Cleanup

Do not opportunistically fix these unless the task requires it:

- dormant `apps/mobile` scaffolding
- root Expo-based `tsconfig.json`
- `packages/shared` export-path issue
- placeholder `ServicesModule` and `ReviewsModule`
- placeholder provider `services` and `finances` pages
- placeholder deploy jobs in GitHub Actions

## Reporting Template

When you finish, report:

1. what you changed
2. what you validated
3. which issues were pre-existing, environment-specific, or newly introduced
4. any important follow-up or unknowns

Honesty about caveats is more useful in this repo than pretending everything is fully encoded and green.
