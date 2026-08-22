## Recommended Connect integration

### A. Account configuration

- Accounts API: `/v2/core/accounts`
- Legacy account `type`: not used
- Dashboard: `express`
- Fee collection: platform (`fees_collector: "application"`)
- Negative balance liability: platform (`losses_collector: "application"`)

This configuration fits a managed services marketplace where the platform owns the customer payment relationship and providers need a lightweight Stripe-hosted dashboard. Each connected account needs the recipient configuration (`configuration.recipient`) with `stripe_transfers` on `stripe_balance` requested, so the account can receive transfers from the platform. Marketplace connected accounts should NOT request merchant configuration or `card_payments` capability; this is unnecessary and causes longer onboarding.

### B. Charge pattern: separate charges and transfers

The platform collects each one-time EUR booking payment and releases the provider share only after the customer confirms the booking as `completed`. The platform is the merchant of record and retains control over transfer timing, refunds, and disputes.

### C. Provider onboarding flow

Onboarding method: Stripe-hosted. A provider signs up in Armut Germany, the API creates an Accounts v2 recipient account, and a hosted Account Link collects verification details. The platform continuously checks requirements and only enables payment and release flows when transfer and payout capabilities are active.

### D. Payments dashboard access for providers

Providers use platform-generated Express Dashboard login links to see earnings, payout details, and tax information. In-app embedded components can cover the most common account-management tasks.

### E. Embedded components

Recommended [Connect embedded components](https://docs.stripe.com/connect/supported-embedded-components):

- `account_onboarding`
- `notification_banner`
- `account_management`
- `payments`
- `payouts`

Payment and dispute detail is reduced for separate charges and transfers, so the platform must provide operational support for refunds and disputes.

### F. Webhook integration

Use webhooks for reliable payment, transfer, refund, and dispute state changes, and always verify incoming signatures before processing event data ([webhook signature verification](https://stripe.com/docs/webhooks/signatures)).

### G. Onboarding status gating

Before enabling payments or provider releases, retrieve the Accounts v2 account and require both recipient capability paths to be active:

- `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status`
- `configuration.recipient.capabilities.stripe_balance.payouts.status`

### H. Fee structure

- Platform fee model: 15% percentage fee
- `applicationFeeIncludes`: `platform_fee_only`
- `application_fee_amount`: not used with separate charges and transfers
- Calculation: transfer 85% of the gross payment to the provider and retain 15% on the platform

Stripe processing fees are charged to the platform and reduce its 15% gross fee. Rates vary by region and payment method; check [Stripe pricing](https://stripe.com/pricing) and monitor the [Connect margin report](https://docs.stripe.com/connect/margin-reports.md).

```text
Customer pays EUR 100
        |
        v
Platform collects EUR 100 and retains EUR 15 minus processing fees
        |
        | transfer EUR 85 after customer-confirmed completion
        v
Provider receives EUR 85 in their Stripe balance
```

### I. SaaS monetization

Not applicable. The current model uses a marketplace transaction fee and does not charge providers a recurring SaaS fee, so `customer_account` and Billing subscriptions are not needed.

### J. Implementation plan

1. Configure sandbox credentials, webhook signing secret, and Accounts v2 recipient onboarding.
2. Remove automatic destination transfer data from Checkout and add a booking transfer group.
3. Persist the source charge, provider transfer, and transfer reversal identifiers.
4. Create an idempotent provider transfer when the customer confirms booking completion.
5. Reverse completed transfers for full refunds and disputes, with idempotent webhook processing.
6. Gate checkout and transfers on active Accounts v2 transfer and payout capabilities.
7. Add Express Dashboard access and run sandbox payment, completion, refund, and dispute tests.

### K. Risk and liability

- Negative balance liability owner: the platform. Connected-account balances can become negative when needed, and transfer reversals recover provider funds for refunds or disputes.
- Risk controls owner: the platform. Radar, dispute operations, reconciliation, and failed reversal monitoring are platform responsibilities.
- Compatibility: `dashboard: "express"`, platform fee collection, platform loss liability, and separate charges and transfers is supported with caution because providers have limited refund and dispute visibility.

### L. Why this fits the business

- A service provider should receive funds only after the customer confirms completion.
- The platform owns the customer checkout and merchant-of-record responsibilities.
- Providers retain a Stripe-hosted earnings and payout view without the platform building a full financial dashboard.
- The existing 15% marketplace commission remains unchanged.

### M. Open questions

- Define the production refund policy, dispute evidence workflow, and operational owner before live mode.
- Confirm tax liability and registrations separately before enabling Stripe Tax.
