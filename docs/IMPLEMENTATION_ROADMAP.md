# Implementation Roadmap

Prepared from the repository and Linear audit on September 11, 2026.

This roadmap orders the known work by dependency and release risk. It does not assign owners, estimates, or due dates; those should be agreed by the team rather than inferred from the repository.

## Operating Rules

- `main` is the canonical integration and release branch.
- Work uses short-lived branches and reviewed pull requests; do not commit directly to `main`.
- Preserve the product invariant that accepting a quote and creating a booking are separate steps unless a deliberate product/API change is approved.
- Treat Stripe, auth, schema, bookings, quotes, messaging, uploads, and notifications as cross-cutting changes that require targeted tests and regression checks.
- Do not call a phase released merely because a placeholder GitHub Actions deploy job is green.

## Phase 0: Reconcile Branches Before More Feature Work

The payment feature now includes the latest `origin/main` dashboard fixes in draft PR [#8](https://github.com/islekeren/armut-germany-start/pull/8). The branch reconciliation steps completed on September 12 were:

1. updated local knowledge of `origin/main` and the payment feature branch
2. fast-forwarded the local payment branch to its remote and merged `origin/main` without rewriting history
3. reviewed the combined dashboard, navigation, notification, and payment changes
4. passed root lint, type-check, build, and all 300 unit tests on the payment branch
5. passed 19/19 API e2e tests and 3/3 Playwright flows on a clean migrated/seeded database

Stripe-hosted sandbox onboarding, real webhook delivery, completion, transfer, cancellation, refund, and dispute checks still require valid test credentials and the safety work below.

Do not merge the payment feature merely to make the branches look aligned. Phase 1 closes its production blockers before ARM-33 is considered released.

The `deployment` branch should not receive new product work. Keep it as a compatibility mirror: merge reviewed work into `main` first, then fast-forward `deployment` from `main`. Verify the actual branch selected by every external host before release.

## Phase 1: Production And Payment Blockers

Implement in this order:

1. **ARM-25 — deployment hardening:** remove automatic `db:seed` from Railway production pre-deploy and document the real migration/release procedure.
2. **ARM-38 — production JWT secrets:** fail safely when secure auth/socket secrets are missing in production; remove reliance on fallback secrets and add configuration tests.
3. **ARM-34 — Stripe eligibility before acceptance:** prevent quote acceptance when the provider cannot receive payments, with an actionable customer/provider state.
4. **ARM-36 — Checkout attempt and processing state:** correlate immutable attempts, reject stale webhook state changes, and distinguish Checkout return from webhook-confirmed payment.
5. **ARM-39 — dispute before payout:** persist dispute state and prevent provider release whether the dispute arrives before or after transfer.
6. **ARM-37 — completion/transfer latency:** decouple or safely handle the provider transfer so customer completion does not time out while Stripe succeeds.
7. **ARM-33 — merge and release payments:** reconfirm payment unit/e2e/manual flows, move draft PR #8 to review, merge it into `main`, and release only through the verified hosting path.

Exit criteria:

- production deploy does not seed demo data
- production cannot start with known fallback JWT secrets
- payment eligibility is checked before the customer commits to the provider
- checkout attempts, webhook processing, disputes, transfers, reversals, cancellation, and refund states are idempotent and visible
- the combined work is on `main` with green release-relevant checks

## Phase 2: Beta Trust And Account Recovery

1. **ARM-22 — forgot password:** implement expiring, single-use reset tokens, non-enumerating responses, email delivery, and reset/revocation tests.
2. **ARM-24 — German beta legal/trust pages:** replace privacy, terms, imprint, help, pricing, and related placeholders with content reviewed by the responsible human/legal owner.

These are beta-entry requirements, not polish. Do not invent legal copy and present it as approved.

## Phase 3: Provider Services And Work Visibility

1. **ARM-28 — provider service management:** implement the service API and dashboard flow, including active state and pricing/category behavior.
2. **ARM-35 — provider request visibility:** use the canonical category/service model so eligible requests appear consistently for providers; add parent/leaf taxonomy regression tests.
3. **ARM-32 — active order behavior:** first pin the issue to a concrete booking/request reproduction, then correct the active-order logic without collapsing accepted quotes into bookings.

ARM-28 comes first because ARM-35 depends on reliable provider service/category data. ARM-32 follows after the input taxonomy is trustworthy.

## Phase 4: Search Decision Then Search Delivery

1. **ARM-31 — search strategy:** choose and document the beta search baseline. Prefer PostgreSQL-backed search unless measured requirements justify Meilisearch operational complexity.
2. **ARM-14 — homepage and category search:** implement homepage submission plus real postcode, price, sorting, pagination, and empty/error states using the chosen backend contract.

The architecture decision must precede UI implementation so the frontend is not built around a temporary, incompatible query model.

## Phase 5: Reliability And Maintainability

Implement in this order:

1. **ARM-18:** apply request taxonomy rules consistently during updates as well as creation.
2. **ARM-19:** preserve abort and timeout semantics when the API client refreshes a token and retries a request.
3. **ARM-17:** prevent notification delivery failures from turning a successful primary mutation into a reported failure.
4. **ARM-20:** stop the web app importing taxonomy/contracts directly from API source; move the stable boundary into a shared package or API response.
5. **ARM-27:** remove the remaining API lint warnings and update validation documentation as the baseline changes.
6. **ARM-26:** add database-aware readiness and centralized production error/observability behavior.

Each item should add focused regression coverage before moving to the next shared-flow change.

## Phase 6: Secondary Product Completion

1. **ARM-29:** narrow the remaining review work to backend module ownership and admin moderation; public/provider review display and provider replies already exist.
2. **ARM-15:** complete provider calendar details, message, availability, and appointment actions.
3. **ARM-13:** narrow the stale scope to route consolidation and remaining service placeholders; orders and settings have real implementations on `main`, while finances becomes functional only in the payment feature branch.
4. **ARM-12:** add the frontend Socket.IO client and reconnect/fallback behavior after REST messaging is stable.

## Phase 7: Mobile Direction

1. **ARM-30:** decide native versus WebView only after the beta web flows and APIs are stable. Record the decision, migration cost, ownership, and supported feature boundary before reviving `apps/mobile`.

Mobile scaffolding should not distract from production web reliability.

## Issue Hygiene

- **ARM-21 is complete** based on the audited category list/detail behavior and tests; keep it in `Done`.
- Rewrite stale issue descriptions to reflect the remaining scope rather than already implemented screens.
- Keep newly discovered payment/provider risks in the project and link release blockers to ARM-33.
- Add concrete reproduction IDs and expected/actual behavior to ARM-32 and ARM-35.
- Assign owners, estimates, cycle placement, and due dates only through an explicit team planning decision.

## Validation Gates By Phase

At minimum:

- docs/config-only: inspect the diff and validate the referenced commands/config syntax
- frontend: web lint, unit tests, build, and type-check
- backend: API lint, type-check, build, and unit tests
- routing/bootstrap/schema/auth/payment: add API e2e
- customer/provider browser flow: add Playwright and targeted manual QA
- release: run the full cross-cutting matrix and verify the real host, branch, migrations, secrets, webhooks, health checks, rollback, and backup path

Use [TESTING.md](./TESTING.md) for the current command matrix and [DEPLOYMENT.md](./DEPLOYMENT.md) for release caveats.
