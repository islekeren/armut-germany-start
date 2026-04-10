# Architecture

Audited against the repository on April 10, 2026.

## System Shape

This repository is a Turborepo monorepo with two active apps:

- `apps/web`: Next.js 16 frontend
- `apps/api`: NestJS 11 backend

There are also support packages in `packages/*` and a dormant `apps/mobile` folder that is not an active npm workspace.

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
- Provider `services` and `finances` routes exist but still render placeholder content

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

- `ServicesModule` and `ReviewsModule` are currently empty shells
- `NotificationsModule` is active and used by request, quote, and booking flows

### API surface

Observed controller groups:

- `/api/auth`
- `/api/users`
- `/api/providers`
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

### Messaging

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

## Shared Packages

### `packages/shared`

- contains shared types and utility exports
- currently blocks root `npm run check-types` because NodeNext exports need explicit file extensions
- no direct app imports were found during this audit

### `packages/ui`

- small component scaffold package
- no direct app imports were found during this audit
- the actual frontend UI lives under `apps/web/components`

## External Dependencies

### Actively wired

- PostgreSQL
- Prisma
- JWT auth
- Swagger
- S3-compatible object storage
- `next-intl`

### Present but only partially wired or not used by current code

- Redis is available locally and in CI, but cache currently runs in memory
- Stripe env variables and a `Payment` model exist, but there is no payments module
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

These areas connect multiple user flows and small changes can create wide regressions.
