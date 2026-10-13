# ARM-17/18/19 Implementation Plan

> Execute inline using superpowers:executing-plans, with test-driven-development and final review.

**Goal:** Preserve successful mutations across notification failures, validate fixed-category request taxonomy updates, and retain one cancellation budget through refresh/retry.
**Architecture:** NotificationsService owns a narrow best-effort callback boundary and safe per-recipient creation. RequestsService shares canonical validation between create/update and computes the final partial-update pair. The API client awaits all three transport stages with one controller and one timer.
**Tech Stack:** NestJS, Prisma, Jest; TypeScript, Vitest, Fetch.
**Spec:** User's ARM-17, ARM-18, ARM-19 acceptance criteria in this conversation.

## Global Constraints
- No outbox, category-changing feature, payment behavior changes or status rule changes.
- Main mutation, authorization, transaction and Stripe errors propagate.
- Logs contain fixed event/operation only; all notification promises handled.
- Keep separate booking creation after quote acceptance.
- Preserve PR #15 UUID correlation, privacy-safe telemetry, FormData, direct/cache behavior.
- Rejected refresh 400/401/403 clears session; transient errors retain it.

## Review Focus
- Synchronous recipient send failures must not suppress other recipients.
- Automated completion message failure must not suppress the in-app notification.
- Legacy missing taxonomy resolves only within the existing category.
- Aborts during response parsing must normalize and clean up.
- One timer covers initial request, refresh and retry; deliberate abort emits no outage telemetry.

### Task 1: ARM-17 notifications
**Files:** NotificationsService, QuotesService, RequestsService.cancel, BookingsService.updateStatus, service specs and notification-failure regression spec.
**Interfaces:** bestEffort(operation: NotificationOperation, task: () => Promise<unknown>): Promise<void>; createBestEffort(userId, payload): Promise<void>.
- [x] Write regression tests for saved quote/create/accept, request cancellation, completion_pending/completed/cancelled and independent recipients under notification/lookup failure. Assert main DB failures reject and mutation counts stay one.
- [x] Run Jest targeted specs; expect regression failures before production edits.
- [x] Implement narrow best-effort boundaries around side effects and post-mutation recipient lookup only; each recipient isolated; constant-only logging.
- [x] Run targeted specs, then API unit suite; expect PASS; commit.

### Task 2: ARM-18 taxonomy
**Files:** RequestsService and requests.service.spec.ts; keep DTO category fixed.
**Interfaces:** private validateTaxonomy(categorySlug, requestSector?, requestBranch?) canonical validated pair.
- [x] Test valid/full/partial pairs, unknown/mismatched/empty/null values, legacy fallbacks, non-taxonomy edits and ownership. Assert invalid inputs cause 400 before update.
- [x] Run targeted Jest; expect new invalid input cases FAIL.
- [x] Extract create validation without changing create rules. When updating taxonomy, reject explicitly null/blank fields and validate incoming fields merged with existing fields and canonical fallback using existing category slug. Leave taxonomy untouched otherwise; preserve location/date handling.
- [x] Run request/create/canonical tests, API suite; expect PASS; commit.

### Task 3: ARM-19 transport
**Files:** apps/web/lib/api.ts, api.test.ts and observability tests.
**Interfaces:** apiRequest remains unchanged; all fetch stages use controller.signal.
- [x] Add fake-timer/abort tests for each stage, total budget, no retry after refresh timeout, retry network normalization, refresh rejection/transient session policy, cleanup and preserved UUID/headers/cache behavior.
- [x] Update #15's intentional old-401 retry assertions to unavailable; run Vitest and expect FAIL before edits.
- [x] Separate refresh and retry; normalize transport/body errors, guard each next stage against aborted signal, await parsing inside cleanup scope; one timeout and listener.
- [x] Run web unit suite, root lint/build/types and root unit suites; expect PASS or document environmental limitations; commit.

### Finish
- [x] Fresh whole-branch review; fix important findings with failing regression first.
- [x] Publish one branch and PR dependent on #15 via GitHub connector if CLI network remains unavailable. No merge/deploy.

## Ledger
- Baseline: PR #15 is open at d1b9951, main is f44f00d. Imported its exact changed files locally for complete test context; final remote commit will parent #15 directly so its files are not duplicated in PR diff.
- User authorized implementation/branch/PR; proceed inline without another permission gate.

- ARM-17: RED 7 failed/2 passed, GREEN 65 targeted tests. Expanded coverage includes synchronous sends, secondary message transaction, and main write/transaction failures.
- ARM-18: RED 18 failed/3 passed, GREEN 62 targeted tests including create/canonical validation.
- ARM-19: RED signal/budget/session/retry failures reproduced; GREEN all 62 web unit tests. Reviewer body-read normalization finding reproduced RED and fixed, with refresh/retry/error-body abort regressions.
- Stripe reviewer: main completion/cancellation persistence remains outside the notification boundary; payment integration is not changed.
- Full API suite: 39 suites/381 tests pass with local-port sandbox network permission. Plain sandbox run fails the pre-existing observability HTTP suite with listen EPERM.
- Root lint: passes with 12 baseline API warnings. Web webpack production build and API build pass. Default Turbopack build is blocked by sandbox port binding; no production configuration changed.
- Ruling: Stack on PR #15 to preserve its observability changes while keeping this PR's diff limited to ARM-17/18/19; #15 must merge first and this PR then targets main.
- Final verification: root npm run test passes 450 tests (API 381, web 62, shared 4, UI 3); root lint and check-types pass. API build and web webpack production build pass. Default Turbopack sandbox bind restriction persists; Docker daemon access is denied, so database E2E/browser smoke were not run.
- Final review finding fixed: response-body stream failure now normalizes as unavailable, not prior HTTP status; regression observed RED then GREEN. No deferred implementation findings.
