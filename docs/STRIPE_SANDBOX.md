# Stripe sandbox setup

This project uses Stripe Connect Accounts v2, hosted Checkout, and separate charges and transfers in test mode. The platform collects a booking payment, retains the configured commission (15% by default), and releases the remaining provider share only after the customer confirms completion.

The implementation currently lives on `codex/stripe-connect-payments` and is not released from `main`. Use this guide only while reviewing and validating that feature branch.

## 1. Configure a test-mode API key

Create a test-mode restricted key in the Stripe Dashboard and grant only the API permissions used by this service: Accounts v2 and Account Links, Checkout Sessions, PaymentIntents read access, Transfers and Transfer Reversals, and Express login links. Use a test secret key temporarily if restricted-key permissions need to be discovered during initial setup, then replace it with the restricted key.

Put the key only in `apps/api/.env`; never commit or paste it into chat:

```dotenv
STRIPE_SECRET_KEY="rk_test_..."
STRIPE_CONNECT_RETURN_URL="http://localhost:3000/dashboard/finances?stripe=return"
STRIPE_CONNECT_REFRESH_URL="http://localhost:3000/dashboard/finances?stripe=refresh"
STRIPE_CHECKOUT_SUCCESS_URL="http://localhost:3000/bookings/{bookingId}?payment=success"
STRIPE_CHECKOUT_CANCEL_URL="http://localhost:3000/bookings/{bookingId}?payment=cancel"
PLATFORM_COMMISSION_RATE=0.15
```

## 2. Apply the database migration

From `apps/api`:

```bash
npm run db:migrate
npm run db:generate
```

The migration stores recipient payout readiness and the Stripe charge, transfer, and reversal identifiers needed for idempotent delayed releases.

## 3. Forward signed webhooks locally

Authenticate the Stripe CLI against the sandbox account, then forward platform events:

```bash
stripe login
stripe listen --forward-to http://localhost:4000/api/payments/webhook
```

Copy the displayed `whsec_...` value into `apps/api/.env`:

```dotenv
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Keep `stripe listen` running while testing. The implementation consumes Checkout completion and asynchronous-result events, PaymentIntent success and failure, full refunds, and disputes (created and closed).

## 4. Start and test the applications

From the repository root:

```bash
npm run dev
```

Use the seeded provider account to open `/dashboard/finances`, create the recipient account, and finish Stripe-hosted onboarding with test data. Refresh until both transfers and payouts are active, then use the seeded customer account to pay an eligible booking with a [Stripe test payment method](https://docs.stripe.com/testing).

Expected lifecycle:

1. Checkout succeeds and the booking payment becomes `paid`.
2. No provider transfer exists yet.
3. The provider requests completion.
4. The customer confirms completion.
5. One idempotent transfer sends the configured provider share (85% by default) to the provider account.
6. A later full refund or dispute reverses that transfer once.

Refunds and disputes:

- The customer can call `POST /api/payments/refund` (booking detail page: "Request a full refund") while the booking is paid and the provider transfer has not been released; admins can refund at any time. The booking becomes cancellable once the `charge.refunded` webhook marks the payment `refunded`.
- A dispute (`charge.dispute.created`) puts the payment on hold, so completing the booking will not release funds until the dispute is won (`charge.dispute.closed`). A transfer that was already released is reversed.
- Partial refunds are not handled; only full refunds change payment state.

## 5. Inspect the sandbox

Confirm the platform charge and delayed provider transfer in the test-mode Dashboard. Use the provider finance page's **Open Stripe Dashboard** action to verify that the connected account can see its earnings and payout information.

Before live mode, define the production refund policy, dispute evidence workflow, tax liability, Radar rules, reconciliation alerts, and restricted-key permissions. The API defaults payments disabled. Sandbox mode rejects live keys; live configuration requires separate explicit opt-in and HTTPS URLs. Do not enable it for these sandbox checks.

## Payment safety validation and recovery

Enable `PAYMENTS_MODE=sandbox` and `STRIPE_WEBHOOK_MODE=sandbox` explicitly before
using the existing sandbox instructions. Keep `STRIPE_LIVE_ENABLED=false`. Do not
use live keys, live Checkout or a production database for these checks.

Checkout Session and PaymentIntent metadata now include `attemptId`. An immutable
PaymentAttempt stores each collection separately. An expired or confirmed failed,
non-payable Session permits a successor; an ordinary PaymentIntent failure does
not prove that its Checkout is non-payable. A stale/duplicate successful collection
is stored and blocks fulfillment with `stale_or_duplicate_collection`, requiring
operator review rather than silently ignoring the money or auto-refunding it.

Migration backfills existing Session/Intent/charge associations as `legacy:<paymentId>`
attempts. Legacy events match exact Stripe object identifiers. Existing dispute
holds without dispute identity remain blocked with
`legacy_dispute_requires_reconciliation`. Historical attempts that were overwritten
before migration cannot be reconstructed from the current Payment row; consult
Stripe records and webhook history for those records.

PaymentOperation stores transfer, reversal, refund and completion work with unique
business identities, immutable request payloads and Stripe idempotency keys.
Stripe calls occur after short local transactions commit. A dispute/refund during
a transfer creates a durable reversal obligation when the transfer ID is stored.
Database finalization failures and crashed workers recover the same payload/key
when their two-minute leases expire. Pending operations retry with bounded batch
sizes; Stripe rejections expose an error code. Operations still ambiguous after
24 hours are held for reconciliation instead of automatically recreating an
external object beyond Stripe v1's guaranteed idempotency retention window.

Operator inspection (against the intended environment only):

```sql
SELECT p.id, p."bookingId", p."reconciliationReason", p."disputedAt",
       p."refundRequestedAt", p."stripeTransferId", p."stripeTransferReversalId",
       o.id AS operation_id, o.kind, o.status, o."errorCode", o."firstCalledAt"
FROM "Payment" p LEFT JOIN "PaymentOperation" o ON o."paymentId" = p.id
WHERE p."reconciliationReason" IS NOT NULL OR p."disputedAt" IS NOT NULL
   OR o.status IN ('pending', 'failed', 'reconciliation_required');
SELECT * FROM "PaymentDispute" ORDER BY "updatedAt" DESC;
SELECT id, type, "createdAt", "nextRunAt", "reconciliationReason" FROM "StripeWebhookEvent"
WHERE "processedAt" IS NULL;
```

Booking detail responses expose safe dispute IDs/status and operation IDs/outcomes,
not Stripe request payloads or KYC details. Unassociated financial webhook payloads
remain durable for later correlation, with delayed replay to avoid starving newer
work. Permanent validation failures are held with an event reconciliation reason
instead of retrying at the head of every worker batch. These payloads contain financial metadata; restrict database access and
include them in the deployment's data retention/security policy.

For an old ambiguous operation, compare immutable operation metadata, the source
charge, destination and amount with Stripe records first. Recover the discovered
object into local state in a short transaction and process any refund/dispute
reversal obligation. Do not merely clear a hold or use a new idempotency key;
that can duplicate money movement. Typed insufficient-funds reversal errors remain retryable on the original
operation/key; permanent reversal rejections explicitly require reconciliation.
A failed reversal or permanent Stripe rejection requires operator remediation. Partial refunds remain a held manual-review case;
no proportional payout policy was introduced. A won dispute never automatically
re-transfers already reversed funds.

Real sandbox verification is pending the user's post-implementation decision about
API access and test credentials. PostgreSQL/API tests and browser tests use explicit
Stripe/API boundary mocks and do not establish successful Stripe integration.
When access is available, verify hosted Checkout, signed webhook delivery,
Connect capability refresh, delayed transfer, refund/reversal and recovery with
actual sandbox object IDs and retain the results separately from mock test logs.
