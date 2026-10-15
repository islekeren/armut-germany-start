# Architecture

Audited against the current checkout on September 11, 2026.

## System Shape

This repository is a Turborepo monorepo with three active apps:

- `apps/web`: Next.js 16 frontend
- `apps/api`: NestJS 11 backend
- `apps/mobile`: Expo Router mobile client (see [Mobile](#mobile) below)

There are also support packages in `packages/*`.

## Frontend

### Core stack

- Next.js 16 App Router
- React 19
- `next-intl` for locale-aware UI
- auth state in `apps/web/contexts/AuthContext.tsx`
- centralized HTTP client in `apps/web/lib/api.ts`

### Route groups and pages

Observed route groups:

- `(auth)`: `/login`, `/register`, `/provider-onboarding`
- `(customer)`: `/customer-dashboard`, `/my-requests`, `/bookings`, `/messages`, `/settings`
- `(provider)`: `/dashboard`, `/dashboard/requests`, `/dashboard/offers`, `/dashboard/orders`, `/dashboard/calendar`, `/dashboard/listings`, `/dashboard/profile`, `/dashboard/reviews`, `/dashboard/messages`, `/dashboard/settings`, `/dashboard/services`, `/dashboard/finances`
- public routes: `/`, `/categories`, `/category/[slug]`, `/find-providers`, `/providers/[id]`, `/create-request`, `/become-provider`, `/how-it-works`, `/requests`, `/notifications`

Observed fallback pages:

- `apps/web/app/[slug]/page.tsx` serves generic coming-soon states for `forgot-password`, `help`, `pricing`, `success-stories`, `imprint`, `privacy`, and `terms`
- `apps/web/app/(provider)/dashboard/[slug]/page.tsx` is a generic provider-dashboard coming-soon fallback for unmatched dashboard slugs

### Frontend boundaries

- Keep backend calls inside `apps/web/lib/api.ts`
- Keep auth token lifecycle inside `apps/web/contexts/AuthContext.tsx`
- Update both `apps/web/messages/en.json` and `apps/web/messages/de.json` when UI copy changes
- Respect App Router server/client boundaries when moving logic

### Frontend current state

- Auth tokens are stored in `localStorage`
- The frontend supports customer bookings, messages, notifications, and request management
- Provider `orders`, `calendar`, `profile`, `reviews`, `messages`, and `requests` have real route implementations
- Provider `/dashboard/services` manages services, active categories, pricing, and visibility through `/api/services`. The `finances` route is a placeholder on `main`; the payment feature branch adds Stripe Connect onboarding, status refresh, and Express Dashboard access to `finances`

## Mobile

`apps/mobile` is an Expo Router app. The native-versus-WebView decision (ARM-30) has been made: it is a thin native shell wrapping `apps/web`, not a native rewrite.

- `app/(auth)/login.tsx` / `register.tsx`: native screens that call `apps/api` directly (`src/lib/api.ts`), independent of the web app's own auth pages
- `app/(app)/web.tsx`: the single screen for authenticated use; a `react-native-webview` `WebView` pointed at `EXPO_PUBLIC_WEB_URL`, with a native fallback screen (`src/components/WebViewError.tsx`) when it fails to load
- `src/providers/SessionProvider.tsx`: holds the session in `expo-secure-store` (not `localStorage`, unlike web) and exposes `signIn`/`registerAccount`/`signOut`/`syncSessionFromWeb`
- **Auth bridge** (native ↔ WebView): on load, native injects the session into the WebView's `localStorage` (`src/lib/routing.ts#buildAuthSyncScript`) under the same keys `apps/web/contexts/AuthContext.tsx` uses. The web app posts `auth-state`/`route-change` messages back via `window.ReactNativeWebView.postMessage` (`apps/web/lib/native-bridge.ts`, `apps/web/components/NativeWebViewBridge.tsx`), which the WebView screen's `onMessage` handler turns back into `SessionProvider` updates. If the web app reports the user logged out, the native app signs out locally and returns to the native login screen.
- **Push notifications**: `src/lib/push.ts` registers the device's Expo push token with the API (`POST /api/notifications/push-token`) on sign-in and session restore, and unregisters it on sign-out. The API's `NotificationsService.create()` fans every notification it already writes (quote/booking/request events) out through `PushNotificationsService` to Expo's push API. Tapping a notification deep-links into the WebView via `src/lib/routing.ts#resolveNotificationPath`, which maps the notification's `type`/metadata to a web path (kept in sync by hand with `apps/api`'s notification payloads). New chat messages do not push yet; messaging bypasses `NotificationsService` via its own Socket.IO gateway.
- Not yet wired: Universal Links/App Links, so a Stripe Checkout/Connect redirect opens in the system browser and does not return to the app; app icon/splash; EAS submit credentials; a final app name decision (`app.json` says "Workify Germany", everything else says "Armut Germany")

## Backend

### Core stack

- NestJS 11
- Prisma with PostgreSQL
- JWT bearer auth
- Swagger at `/api/docs`
- app-wide prefix at `/api`

### Registered modules

Observed in `apps/api/src/app.module.ts`:

- `AuthModule`
- `UsersModule`
- `ServicesModule`
- `AdminModule`
- `RequestsModule`
- `CategoriesModule`
- `ProvidersModule`
- `BookingsModule`
- `ReviewsModule`
- `MessagesModule`
- `QuotesModule`
- `UploadsModule`
- `NotificationsModule`

Important nuance:

- `ServicesModule` handles provider-owned CRUD; `ReviewsModule` is currently an empty shell
- `NotificationsModule` is active and used by request, quote, and booking flows

### API surface

Observed controller groups:

- `/api/auth`
- `/api/users`
- `/api/providers`
- `/api/services`
- `/api/categories`
- `/api/requests`
- `/api/quotes`
- `/api/bookings`
- `/api/messages`
- `/api/uploads`
- `/api/admin`
- `/api/notifications`

### Common infrastructure

- `apps/api/src/common/prisma`: Prisma lifecycle and DB access
- `apps/api/src/common/cache`: cache wrapper around Nest cache manager
- `apps/api/src/common/throttle`: global throttling guard
- `apps/api/src/common/security`: sanitization helpers

## Data Model

Observed in `apps/api/prisma/schema.prisma`:

- `User`
- `Provider`
- `ProviderProfile`
- `Category`
- `Service`
- `ServiceRequest`
- `Quote`
- `Booking`
- `Payment`
- `Review`
- `Conversation`
- `ConversationParticipant`
- `Message`
- `Notification`

Key relationships:

- a `User` can be a `customer`, `provider`, or `admin`
- a provider user can own one `Provider` and one `ProviderProfile`
- customers create `ServiceRequest` records
- providers submit `Quote` records against requests
- a `Booking` belongs to an accepted quote
- a `Review` belongs to a booking
- conversations and messages can be tied to a request
- notifications belong to users and track read state

## Core Flows

### Auth flow

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- frontend persists access and refresh tokens in `localStorage`

Note:

- `JWT_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` exist in the env example, but current auth code uses hardcoded expirations

### Request to quote to booking

- Request creation rejects empty or whitespace-only titles/descriptions at the API boundary. The wizard validates these fields before review and submission, including restored guest drafts, with German and English field errors.

Observed behavior:

1. customer creates a service request
2. provider submits a quote
3. customer accepts or rejects the quote
4. accepting a quote marks that quote as `accepted`, rejects the rest, and sets the request to `in_progress`
5. the frontend then routes the customer to `/bookings/new`
6. booking creation happens in a separate API call and requires an already accepted quote

Important invariant:

- accepted quote does not automatically equal booking

### Booking lifecycle

- booking creation requires an accepted quote
- bookings move through `pending`, `confirmed`, `in_progress`, `completion_pending`, `completed`, and `cancelled`
- booking completion and other state changes can emit notifications

### Payments and Stripe Connect

The current `codex/stripe-connect-payments` checkout contains:

- provider Stripe Connect Accounts v2 onboarding and status refresh
- Express Dashboard login links
- hosted Checkout sessions using separate charges and transfers
- signed webhook processing that records successful booking payments
- delayed provider transfer after customer-confirmed completion
- paid bookings must be refunded before cancellation

Release boundary:

- this implementation has not yet been merged into `origin/main`
- `main` must remain the canonical integration branch; synchronize, review, test, and merge the feature branch before describing payments as released

Known reliability work before production use:

- block quote acceptance when the selected provider cannot receive Stripe payments
- distinguish a returned Checkout session from a webhook-confirmed payment instead of showing an active payment state too early
- avoid coupling booking-completion HTTP latency to a synchronous provider transfer

### Messaging

- Initial conversation selection honors `?conversation=`; subsequent REST polls preserve user selection, including returning to the mobile list, on customer and provider pages.

- backend supports REST and a Socket.IO gateway
- current frontend messaging UI uses REST-driven flows and refresh patterns
- do not describe messaging as fully realtime unless the frontend socket client is added

### Uploads

- uploads are stored in S3-compatible storage
- folders are segregated by purpose and user ID
- deletion is guarded by a prefix ownership check

### Notifications

- authenticated users can list notifications
- unread count is exposed separately
- users can mark one notification or all notifications as read
- quote creation/acceptance, request cancellation, and booking completion/cancellation
  notifications are best-effort after the main mutation succeeds; each recipient
  is attempted independently. Automated completion messages follow the same rule.
  Notification failures do not trigger mutation retries; no outbox or durable
  delivery guarantee is implemented.
- request taxonomy edits validate the final sector/branch combination against the
  existing category. Missing legacy values resolve within that category; ordinary
  title/location/date edits leave taxonomy untouched.
- API requests share one timeout and abort signal across the initial request,
  token refresh, and one retry. Refresh rejection clears the session; transport,
  timeout, rate-limit and server errors retain it. Caller abort is not reported
  as an outage.

## Shared Packages

### `packages/shared`

- contains shared types and utility exports
- is declared as a dependency by both active apps but is not yet broadly imported by application source
- passes its current lint, type-check, and unit-test tasks
- is not yet the single source of truth for every API/frontend contract

### `packages/ui`

- small component scaffold package
- is available to the web app as `@repo/ui`, although most product UI still lives under `apps/web/components`
- the actual frontend UI lives under `apps/web/components`

## External Dependencies

### Actively wired on `main`

- PostgreSQL
- Prisma
- JWT auth
- Swagger
- S3-compatible object storage
- `next-intl`

### Wired in the payment feature branch but not yet on `main`

- Stripe Connect Accounts v2 onboarding, hosted Checkout, signed payment webhooks, and delayed transfers

### Present but only partially wired or not used by current code

- Redis is available locally and in CI, but cache currently runs in memory
- On `main`, Stripe env variables and a `Payment` model exist, but there is no payments module
- SendGrid env variables exist, but no email integration was found
- Meilisearch dependency and env example exist, but no active search module was found
- Google Maps env example exists, but no active Google Maps integration was found in current code

## Danger Zones

Treat these files and areas as high-risk:

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
- `apps/mobile/src/providers/SessionProvider.tsx` and `apps/mobile/app/(app)/web.tsx`: the native/WebView auth bridge
- `apps/web/contexts/AuthContext.tsx` also now emits `auth-state`/`route-change` events for the mobile bridge (`apps/web/lib/native-bridge.ts`); changing its token-storage keys or event shape breaks mobile sign-in without a mobile-side code change

These areas connect multiple user flows and small changes can create wide regressions.

## Provider flow recovery

- Customer rescheduling moves a pending/confirmed booking to `pending`. The
  provider must confirm the new date from Orders before requesting completion.
  The existing booking status endpoint enforces ownership and rejects completion
  from `pending`; final completion remains a customer action.
- A provider account without a `Provider` record resumes `/provider-onboarding`.
  Dashboard access checks for that record first. Only a 404 means missing setup;
  failed network/profile checks offer a retry. An authenticated provider completes
  the profile using their existing account, without submitting registration again.
- `POST /api/providers` returns the existing own provider on a retry, without
  overwriting it or duplicating its services. Nested creation is atomic, and a
  concurrent unique-key conflict is recovered only when that user's provider
  exists. Profile updates still use the separate update endpoint.
- Offers includes pending and accepted quotes. An accepted quote without a
  booking is explicitly waiting for the customer to create one. Quote acceptance
  never creates a booking. Once booked, the offer links to the actual order via
  `/dashboard/orders?booking=<id>`. The authenticated provider quote response
  includes only the associated booking's ID and status for this link.

### Provider request matching policy (ARM-35)

Listings and direct-ID provider request access use the same eligibility rule:
`open` request + exact `categoryId` of an active provider service + configured
service radius. Sector/branch metadata is presentation information; it does not
broaden eligibility. A parent-category service does not match child requests,
and a leaf service does not match parent or sibling requests. Inactive services
and requests outside the radius do not grant access through a direct ID either.
Providers without configured coordinates retain the existing no-distance-filter
behavior.

The listings UI distinguishes no active services, no eligible requests, and
requests excluded by local filters. The profile link opens the working profile
screen to inspect services or edit location/radius. Service activation/category
editing is currently unavailable in the dashboard; the empty state states this
explicitly and does not link to the Services placeholder. Refresh Listings and
Clear Filters operate on the actual feed and controls.

Regression evidence lives in `providers.e2e-spec.ts` (including parent/child,
sibling, inactive, empty and radius access), `quotes.e2e-spec.ts` (awaiting booking
and all four active booking states), `bookings.e2e-spec.ts` (pending transition
restrictions), and `apps/web/e2e/provider-recovery.spec.ts` (browser recovery flows).

## Provider service management

`GET /api/services` lists all services owned by the authenticated provider,
including inactive services. `POST /api/services`, `PATCH /api/services/:id`,
and `DELETE /api/services/:id` create, update, and remove services. These routes
require JWT authentication and a provider account with a provider profile.
Mutations resolve ownership from the authenticated user; foreign and missing
service IDs return 404. Client-supplied provider IDs and images are not writable.

Creation and category changes require an active leaf category. Reactivation
also revalidates the category; a provider can deactivate or delete a service
whose category has been retired. Pricing supports `fixed`, `hourly`, and `quote`,
with optional nonnegative bounds. Explicit `null` clears a bound; omitted bounds
on partial updates preserve stored values. The merged minimum cannot exceed
the merged maximum. No schema migration is needed.

Public profiles, category search, and provider request feeds query the current
active services directly. Service updates do not change existing quotes or bookings.
The dashboard shows localized English/German fields, mutation feedback, a
retryable initial load, and a confirmation before deletion.
