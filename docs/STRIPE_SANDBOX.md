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

Keep `stripe listen` running while testing. The implementation consumes Checkout completion and asynchronous-result events, PaymentIntent success and failure, full refunds, and newly created disputes.

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

## 5. Inspect the sandbox

Confirm the platform charge and delayed provider transfer in the test-mode Dashboard. Use the provider finance page's **Open Stripe Dashboard** action to verify that the connected account can see its earnings and payout information.

Before live mode, define the production refund policy, dispute evidence workflow, tax liability, Radar rules, reconciliation alerts, and restricted-key permissions. The API intentionally rejects live keys while this integration remains sandbox-only.
