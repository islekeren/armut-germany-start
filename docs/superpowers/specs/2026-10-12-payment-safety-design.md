# Payment safety and transaction consistency

Base: `origin/codex/stripe-connect-payments` at `d4f2e14a8f56ad835b01319c5c80de4eb6a770c5`.
Branch: `codex/payment-safety-consistency`.
Scope: ARM-36, ARM-39, ARM-34, ARM-37 and explicit disabled/sandbox/live policy.

## Intent and constraints

Preserve hosted Checkout, Accounts v2 Connect onboarding, separate charges and delayed provider transfers, existing amounts/commission, full-refund authorization and platform merchant responsibilities. Do not deploy, enable live mode or perform real-money transactions. Keep quote acceptance and booking creation separate.

## Approach

Use PostgreSQL as the coordination authority and a durable operation/outbox worker for external side effects. An in-memory mutex cannot coordinate API instances. Holding a database transaction across Stripe calls risks exhausted connections and still cannot atomically commit Stripe and database outcomes. Short row-lock transactions plus immutable operation identity, stable Stripe idempotency keys and recovery provide the required boundary.

## 1. Checkout attempts — ARM-36

Add PaymentAttempt with immutable UUID, payment relation, sequence, immutable amount/currency and request snapshot, unique Checkout Session and PaymentIntent identifiers, charge identifier and lifecycle timestamps/state. Payment identifies its active and selected paid attempt. Backfill existing session/intent associations into legacy attempts; resolve legacy events by exact Stripe object identifiers, never by payment metadata alone.

Under a Payment row lock, reuse or reserve the active attempt. Concurrent callers share that attempt and its Stripe idempotency key. Persist the full creation payload before calling Stripe outside the transaction. Recovery retries the identical payload/key. A successor is permitted only after the predecessor is confirmed non-payable; a failed PaymentIntent alone does not establish that an open Checkout Session is non-payable. An uncertain creation/expiration result blocks replacement until reconciled.

Include attemptId in both Session and PaymentIntent metadata. Validate ownership, amount, currency and object binding. Failure/expired events affect only their own attempt and cannot regress paid states. Persist every successful collection, including inactive attempts. Select one valid collection for fulfillment; block payout and expose reconciliation reasons for stale/duplicate collections. Do not silently discard or automatically refund them. Success/failure order and event replay must not create duplicate notifications or re-enable payment.

## 2. Transfer versus dispute/refund — ARM-39

Persist dispute ID, charge/intent associations, Stripe event time and status. Store unmatched financial events durably for later association, including dispute-before-payment-confirmation. A delayed created event cannot reopen a closed dispute. Retain the current rule that a won dispute removes the hold; never automatically re-release a reversed transfer.

All payout claims, refund requests and financial webhook updates acquire the same Payment row lock for local decisions. Persist a refund intent before the Stripe call so payout cannot start during a refund request. Preserve customer/admin authorization; a claimed transfer counts as release-in-progress when deciding customer refund eligibility.

Reserve transfer/reversal operations with immutable payloads and stable idempotency keys. Make Stripe calls outside transactions. On transfer response, persist its ID and re-evaluate current holds/refunds in one transaction; enqueue reversal when necessary. Events received while transfer has no ID persist the reversal obligation. Reversal failures remain durable and retryable. A database failure after Stripe success recovers through the same operation identity and metadata reconciliation. Do not blindly create again once Stripe's idempotency retention window has elapsed; ambiguous old operations require lookup/manual reconciliation.

## 3. Provider eligibility — ARM-34

Move eligibility into one Connect service: account exists, onboarding ready, transfers enabled, payouts enabled. All acceptance/Checkout/transfer decisions refresh the account from Stripe before applying this rule, regardless of stored flags. A missing account denies immediately; upstream failure returns a temporary verification-unavailable outcome and does not permit mutation.

Acceptance performs the refresh before quote/request mutation. Customer quote responses expose safe eligibility/reason fields without KYC details. UI explains verification incomplete/unavailable and handles readiness changing after render. Backend remains authoritative. No local lock can prevent Stripe capabilities changing after its read; actual Stripe rejection must remain recoverable.

## 4. Completion operations — ARM-37

Persist one completion operation per booking and expose pending/processing/succeeded/failed/reconciliation-required state. The customer request reserves it and returns promptly; repeated authorized requests reuse it, including after completion. A durable worker claims bounded leases and resumes pending operations after restart. A failed/ambiguous transfer is recovered with the original payload/key, never a second transfer identity.

Commit booking/request completion and exactly-once local notification effects together after transfer success and the current refund/dispute decision. If money moved but a hold arrived, preserve the transfer record, reverse/reconcile and expose a blocked outcome rather than claiming successful completion.

Frontend disables repeat submission, polls the authoritative operation after acceptance or client timeout, and shows successful completion as success. Stripe rejection is distinguishable from browser timeout; bounded polling exhaustion shows processing/unresolved with a refresh path, never an invented failure.

## 5. Payment confirmation UI — ARM-36

Expose safe checkout state (not-started/open/confirmation-processing/paid/failed/expired/reconciliation-required) in booking details. Reconcile Stripe Session state outside transactions when local state is insufficient, so refresh/revisit without query parameters detects a completed Session. URL success is only an immediate processing hint, never proof of payment.

Render processing inside the payment section and remove Pay while processing or reconciliation is required. Poll with bounded attempts/backoff and cleanup; stop on terminal state. Retry appears only for a confirmed eligible attempt. Include English/German translations and browser tests for refresh, absent query string, delayed webhook, terminal transitions and repeated clicks.

## 6. Configuration

Explicit PAYMENTS_MODE=disabled|sandbox|live; default disabled. Disabled performs no payment/Connect external calls and exposes an unavailable reason. Enabled modes require complete key, webhook, return/cancel URL configuration and explicit webhook mode matching the selected payment mode. Secret prefixes must match; an optional publishable key must match too. Validate signed event livemode and Stripe API object mode where available. A whsec prefix cannot establish webhook mode/account provenance: document this limitation and require a verified endpoint setup.

Live requires an additional explicit opt-in, HTTPS URLs and matching live configuration; no live configuration or calls will be exercised in this task. Validate even under NODE_ENV=test; mocks explicitly opt into a test configuration. Keep commission calculations unchanged.

## Validation and delivery

Implement in the user's six-step order, with additive migrations and targeted failing regression tests first. Use real PostgreSQL/API tests for multi-instance claims and webhook races; mocks alone cannot prove database coordination. Test concurrent retries, stale failures, event ordering/replay, refund/dispute before/during/after transfer, failed reversal, Stripe-success/database-failure recovery, readiness states, completion timeout/server success and genuine Stripe failure.

Run API lint/types/build/unit and targeted API integration suites, web lint/types/build/unit and targeted Playwright coverage, then repository required cross-cutting checks. Exercise worker restart/lease recovery and migration backfill against disposable databases.

Real Stripe sandbox validation must use authorized non-live credentials, actual Checkout/Connect/transfer/refund APIs and signed webhook delivery; report actual object IDs and outcomes separately from mock results. Current environment readiness reports no secret bindings and its enforced allowlist excludes api.stripe.com. This is an environment prerequisite, not evidence of a Stripe failure. Do not claim real verification until access and credentials are available and the actual flow succeeds.

Deliver a draft PR against codex/stripe-connect-payments with migration instructions, completed validation, explicit outstanding sandbox checks and residual operational risks (worker availability, old ambiguous operations, webhook configuration provenance and existing partial-refund business rules).
