# Payment Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete payment safety and consistency blockers of draft PR #8 without changing business payment rules.

**Architecture:** PostgreSQL row locks coordinate local decisions across API instances. Immutable attempts and durable operations store stable Stripe payloads/idempotency keys; a leased worker performs external calls outside transactions and reconciles ambiguous results.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Stripe Node SDK, Next.js/React, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-payment-safety-design.md`

## Global Constraints

- Preserve hosted Checkout, Accounts v2 onboarding, separate charges and delayed provider transfers.
- Preserve fee calculations, full-refund authorization, merchant responsibility and separate quote acceptance/booking creation.
- No live calls, live enablement, production migration or deployment.
- Default PAYMENTS_MODE is disabled; enabled modes require explicit coherent configuration.
- Update both English and German copy.
- Sandbox API access and test credentials will be discussed with the user after implementation. Mock verification is reported separately.

## Review Focus

- Stripe success followed by database failure: recover the same external operation without creating another payment/transfer.
- Financial webhook preceding local object association: retain the event and apply it when correlation becomes available.
- More than 24 hours of uncertainty: stop automatic recreation beyond idempotency retention and flag reconciliation.
- Worker crash after claiming: expired lease recovers the same immutable payload/key.
- Readiness changes after page render: server checks fresh eligibility before mutation; UI explains rejection.

### Task 1: Immutable Checkout attempts — ARM-36

**Files:** Modify `apps/api/prisma/schema.prisma`, `apps/api/src/modules/payments/payments.service.ts`, `apps/api/src/modules/payments/stripe.service.ts`; create an additive SQL migration under `apps/api/prisma/migrations`, `apps/api/src/modules/payments/payment-coordination.service.ts`, `apps/api/src/modules/payments/payment-attempts.service.ts`; modify `apps/api/src/modules/payments/payments.module.ts`; test `apps/api/src/modules/payments/payment-attempts.service.spec.ts` and `apps/api/test/payments.e2e-spec.ts`.

**Interfaces:** `PaymentCoordinationService.withPayment<T>(paymentId: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>` uses a short PostgreSQL row-lock transaction. `PaymentAttemptsService.createCheckout(userId: string, bookingId: string)` preserves the existing redirect response for open sessions and provides a processing result for completed sessions. `reconcileCheckout(paymentId: string)` resolves remote state outside the lock. `applySession(tx, session, outcome)` and `applyIntent(tx, intent, outcome)` correlate by attemptId or exact legacy object identifiers.

- [ ] Write regression tests asserting simultaneous retry yields one active attempt/session, inactive failure leaves newer attempt unchanged, success is absorbing within an attempt, duplicate success notifications occur once, late paid attempt is recorded and blocks fulfillment, and database failure recovers one Session.
- [ ] Run targeted Jest/API tests and confirm the regressions fail against the current implementation.
- [ ] Add PaymentAttempt, active/paid attempt references, immutable request payload, reconciliation reason and lifecycle fields. Backfill legacy identifiers and amounts with deterministic attempt IDs; constrain unique associations and sequence. Reserve/reuse under lock, call Stripe with stable payload/key, finalize under lock. Only verified non-payable sessions allow successors. Persist stale collection and hold instead of ignoring it. Wire expired events.
- [ ] Run targeted tests, Prisma validation/generation and migration on a disposable database; verify the two-instance concurrent test and legacy-event matching.
- [ ] Commit the independently testable attempt changes.

### Task 2: Durable dispute/refund/transfer coordination — ARM-39

**Files:** Modify schema and add migration; create `apps/api/src/modules/payments/payment-operations.service.ts`, `apps/api/src/modules/payments/payment-reconciliation.worker.ts`; modify payments service/module and Stripe wrapper; test `payment-operations.service.spec.ts`, `payment-reconciliation.worker.spec.ts`, and `apps/api/test/payments.e2e-spec.ts`.

**Interfaces:** `PaymentOperationsService.requestTransfer(paymentId: string): Promise<PaymentOperation>` and `requestRefund(user: {id: string; userType?: string}, bookingId: string): Promise<PaymentOperation>` reserve immutable operations under the shared lock. `runOperation(operationId: string): Promise<void>` claims a lease, calls Stripe outside the transaction and finalizes/reconciles. `drain(limit: number): Promise<void>` recovers runnable/expired-lease operations. Dispute/refund ingestion persists obligations before marking events processed.

- [ ] Write tests for dispute/refund before/during/after transfer, created-after-closed dispute, unmatched dispute before intent association, failed reversal/replay, customer refund during claimed payout, worker lease recovery, Stripe success followed by database failure and uncertainty older than 24 hours.
- [ ] Run tests and confirm each missing behavior fails.
- [ ] Add PaymentDispute with durable Stripe identity/status/event order, PaymentOperation with unique business identity/type/status/payload/key/lease/timestamps/error, and persisted webhook payload/association state. Coordinate transfer claims, refund intents and webhook writes under the same lock. Late holds enqueue reversal when transfer returns. Preserve authorization and irreversible-transfer holds. Recover using the original Stripe operation identity; uncertain operations older than 24 hours require reconciliation rather than blind recreation.
- [ ] Verify targeted unit and real-PostgreSQL API tests, including simulated DB finalization failure and worker restart. Ensure no Stripe mock is invoked inside an open DB transaction.
- [ ] Commit the coordinated operations and recovery changes.

### Task 3: Shared fresh provider eligibility — ARM-34

**Files:** Modify `apps/api/src/modules/payments/stripe-connect.service.ts`, payments service, quotes service/module; modify `apps/web/lib/api.ts`, `apps/web/app/(customer)/my-requests/[id]/page.tsx`, `apps/web/messages/en.json`, `apps/web/messages/de.json`; tests in Connect/quotes unit suites, `apps/api/test/quotes.e2e-spec.ts`, and `apps/web/e2e/customer-requests.spec.ts`.

**Interfaces:** `StripeConnectService.getEligibility(providerId: string): Promise<{eligible: boolean; reason: 'ready'|'missing_account'|'verification_incomplete'|'verification_unavailable'|'payments_disabled'}>` refreshes existing accounts without a cached readiness precondition. `ensureEligible(providerId: string): Promise<Provider>` is authoritative before acceptance, Checkout and transfer. Quote customer responses expose only eligibility and safe reason.

- [ ] Write tests for missing/pending/restricted/transfers-disabled/payouts-disabled states, cached false becoming ready, cached true becoming restricted, upstream failure, and eligibility changing after render. Assert no quote/request mutation for rejection.
- [ ] Run targeted tests to demonstrate existing cache divergence.
- [ ] Centralize fresh-read eligibility, inject Connect into QuotesModule, guard before mutations and provide customer-safe eligibility fields. Render explanations and handle backend race rejection in English/German.
- [ ] Verify quote API/unit suites and Playwright acceptance flow.
- [ ] Commit shared eligibility changes.

### Task 4: Durable completion outcome — ARM-37

**Files:** Modify booking service/controller/DTO and payments operation/worker services; modify `apps/web/lib/api.ts`, customer booking detail page and translations; test booking unit/API suites, authorization route tables if adding a route, and customer booking Playwright suite.

**Interfaces:** `requestCompletion(userId: string, bookingId: string): Promise<{operationId: string; status: string}>` reserves/reuses one completion operation. Booking detail exposes `completionOperation: {id: string; status: string; errorCode?: string}|null`. Worker completes booking/request and local notifications atomically after reconciled payout. Repeated authorized completion requests return the original result.

- [ ] Write tests for delayed Stripe response, browser timeout/server success, repeat requests, actual Stripe failure, transfer success/DB failure recovery and dispute during completion.
- [ ] Confirm regressions fail, including current completed-booking retry rejection.
- [ ] Return durable operation promptly, resume via worker, commit completion state atomically and expose outcomes. Frontend holds processing state, polls after request acceptance/timeout and distinguishes actual failure from unresolved outcome; second click never creates another transfer.
- [ ] Run targeted booking API/unit and browser tests, checking worker restart recovery.
- [ ] Commit durable completion changes.

### Task 5: Authoritative payment processing UI — ARM-36

**Files:** Modify booking details select/serialization, attempts reconciliation service, `apps/web/lib/api.ts`, booking detail page and translations; test attempts unit/API suites and `apps/web/e2e/customer-bookings.spec.ts`.

**Interfaces:** BookingPayment exposes `checkoutState: 'not_started'|'open'|'confirmation_processing'|'paid'|'failed'|'expired'|'reconciliation_required'` and `canRetry: boolean`. Booking read reconciles uncertain remote session status outside DB transactions. Frontend polls boundedly with backoff/cleanup and never treats URL success as authoritative payment.

- [ ] Write tests for success return, refresh/revisit without payment query, webhook delay, paid/failed transition, repeated clicks and polling cleanup/exhaustion.
- [ ] Confirm current Pay CTA regression in browser test.
- [ ] Show inline processing, hide Pay until confirmed eligible, honor authoritative remote/local status and add English/German processing/unresolved/retry copy.
- [ ] Run targeted browser and API tests.
- [ ] Commit processing UI changes.

### Task 6: Explicit configuration and delivery

**Files:** Modify Stripe service and add configuration unit tests; update API/web env examples, test harnesses, `turbo.json`, `docs/ENVIRONMENT.md`, `docs/STRIPE_SANDBOX.md`, and `docs/TESTING.md`.

**Interfaces:** `StripeService.getPaymentsMode(): 'disabled'|'sandbox'|'live'`; startup validates coherent configuration in every NODE_ENV. Disabled rejects external payment/Connect operations. Live requires explicit opt-in and HTTPS; signed event mode must match configured webhook/payment mode.

- [ ] Write tests for disabled default/no calls, missing keys/webhook/URLs, mismatched test/live credentials and webhook declaration, malformed modes, live without opt-in, live insecure URLs and wrong signed event mode.
- [ ] Confirm current test-mode validation bypass fails the new tests.
- [ ] Implement explicit configuration and test fixture opt-in without changing commission or SDK/API versions unnecessarily. Document whsec provenance limitation, worker operation/recovery, migration/backfill and manual remediation.
- [ ] Run repository lint/build/types, API unit and relevant API integration suites, web unit and relevant Playwright suites. Record genuine failures and environment limitations separately. Check final diff and review payment invariants before committing.
- [ ] Create a draft PR against `codex/stripe-connect-payments` with validation evidence and remaining risks, attach it to this chat. State real sandbox verification is pending user discussion of API access/test credentials; do not report mock success as Stripe verification.

## Execution method

Recommended: native implementation in this chat. The six ordered tasks share attempt, operation and locking interfaces, so keeping implementation in one context avoids parallel schema and service edits. No live or sandbox network verification runs before the user's post-implementation access discussion.
