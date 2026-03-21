# Agent Guide

## Purpose

This file is a practical operating manual for autonomous coding agents working in this repository.

Use it to reduce ambiguity, avoid broad edits, and report work honestly.

## Start Here

Before making changes:

1. Read [README.md](./README.md).
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md).
3. Read [TESTING.md](./TESTING.md).
4. Read [ENVIRONMENT.md](./ENVIRONMENT.md) if the task touches env, runtime, uploads, or deployment.
5. Inspect the exact feature files involved.

Then check repository state:

```bash
git status --short
```

Do not overwrite unrelated user changes.

## What To Read First By Task Type

### Frontend page or UI issue

Read:

- `apps/web/app/...` route file
- `apps/web/components/...` used by that route
- `apps/web/lib/api.ts` if the page talks to the backend
- `apps/web/messages/en.json`
- `apps/web/messages/de.json`

### Backend endpoint or business logic issue

Read:

- matching controller in `apps/api/src/modules/*`
- matching service in `apps/api/src/modules/*`
- matching DTO file
- `apps/api/src/app.module.ts`
- `apps/api/prisma/schema.prisma` if persistence is involved

### Auth, permissions, or user data issue

Read:

- `apps/api/src/modules/auth/*`
- `apps/api/src/modules/users/*`
- `apps/api/src/modules/admin/admin.guard.ts`
- `apps/api/src/common/security/*`
- `apps/web/contexts/AuthContext.tsx`

### Messaging issue

Read:

- `apps/api/src/modules/messages/messages.controller.ts`
- `apps/api/src/modules/messages/messages.service.ts`
- `apps/api/src/modules/messages/messages.gateway.ts`
- `apps/web/components/messages/MessagesWorkspace.tsx`
- relevant messages page in `apps/web/app/.../messages/page.tsx`

## Planning Rules

- Plan from the code that exists, not from assumptions.
- Prefer the smallest change that satisfies the task.
- Trace the full flow before changing shared types, auth, or state transitions.
- If a task touches multiple layers, identify the narrowest seam first.

Good plan shape:

1. inspect the local flow
2. edit the smallest relevant files
3. run targeted validation
4. report what changed and what is still unknown

## Minimal Edit Rules

- Do not broad-refactor unrelated files.
- Do not rename modules, routes, or env vars casually.
- Do not move frontend API calls out of `apps/web/lib/api.ts` unless you are intentionally restructuring the data layer.
- Do not invent shared abstractions in `packages/ui` or `packages/shared` unless the current app code is actually using them.
- Keep translation updates paired across German and English message files.

## Validation Rules

Use [TESTING.md](./TESTING.md) as the source of truth.

Key repository-specific rules:

- In restricted environments, API Jest runs are more reliable with `--watchman=false`.
- Root lint and root type-check are already failing on baseline.
- Web build currently has a real TypeScript failure in `apps/web/lib/api.ts`.
- API e2e tests are stale and should not be treated as authoritative.

When validating, prefer:

- app-level checks over root-level checks when your change is isolated
- passing checks before broken global checks
- explicit reporting of baseline failures

## Danger Zones

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

Reasons:

- These files connect multiple flows.
- Small mistakes here create broad regressions.
- Several already have known mismatches or incomplete behavior.

## Assumptions You Must Not Silently Change

- Accepted quotes do not automatically create bookings today.
- Locale is cookie-based, not route-based.
- Auth tokens are stored in browser `localStorage`.
- Public provider pages depend on backend-composed profile payloads.
- API routes live under `/api`.
- Uploads are intended for S3-compatible storage, but the env contract is not fully settled.

If your task would change any of the above, stop and call it out explicitly.

## When To Ask For Human Clarification

Stop and ask when:

- the task implies changing auth semantics
- the task implies changing billing or payment behavior
- the task implies changing public API contracts used by multiple pages
- a schema change requires guessing business rules
- the checked-in code and docs disagree and both interpretations seem plausible
- deployment behavior needs to change, but the target platform is still unknown

## When To Avoid Cleanup

Do not opportunistically fix these unless the task requires it:

- stale `dev:mobile` script
- stale Expo root tsconfig
- placeholder deploy steps
- placeholder backend modules
- broken global validation unrelated to the task

These are real repository issues, but broad cleanup can easily become unrelated churn.

## Reporting Template

When you finish, report:

1. what you changed
2. which validations you ran
3. which failures were pre-existing versus introduced
4. any important unknowns or follow-up work

Good example:

- Changed provider dashboard request card rendering in `apps/web/app/(provider)/dashboard/page.tsx`
- Ran `cd apps/web && npm run lint`
- Did not run `npm run build` because current baseline still fails in `apps/web/lib/api.ts`
- No changes to auth, schema, or API contracts

## Final Rule

Be honest about uncertainty.

In this repository, a precise report with explicit unknowns is more useful than a confident but guessed explanation.
