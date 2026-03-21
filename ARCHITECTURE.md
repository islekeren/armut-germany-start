# Architecture

## System Shape

Observed:

- The repository is a Turborepo monorepo.
- The web frontend lives in `apps/web`.
- The backend API lives in `apps/api`.
- Shared packages live in `packages/*`.

Inferred:

- The repository is intended to support a two-sided marketplace with customers and providers.

## Major Components

### `apps/web`

Observed:

- Framework: Next.js 16 App Router
- Internationalization: `next-intl`
- State for auth: `apps/web/contexts/AuthContext.tsx`
- API client: `apps/web/lib/api.ts`
- Route groups:
  - `(auth)` for login, register, provider onboarding
  - `(customer)` for customer messages and request management
  - `(provider)` for provider dashboard pages

Important files:

- `apps/web/app/layout.tsx`: global providers, fonts, locale-aware HTML wrapper
- `apps/web/lib/api.ts`: all frontend HTTP calls and most frontend API types
- `apps/web/components/*`: reusable UI pieces
- `apps/web/messages/en.json`, `apps/web/messages/de.json`: translation dictionaries

### `apps/api`

Observed:

- Framework: NestJS 11
- ORM: Prisma
- Database: PostgreSQL
- Auth: JWT bearer tokens
- API prefix: `/api`
- API docs: Swagger at `/api/docs`

Observed backend modules registered in `apps/api/src/app.module.ts`:

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

Observed common infrastructure:

- `apps/api/src/common/prisma`: Prisma provider and lifecycle
- `apps/api/src/common/cache`: cache wrapper
- `apps/api/src/common/throttle`: global throttling guard
- `apps/api/src/common/security`: sanitization helpers

### `packages/shared`

Observed:

- Exports Zod-based types and formatting helpers.
- The package is configured as ESM and currently breaks root type-checking because internal exports use extensionless relative imports under `NodeNext`.

Observed usage:

- No direct imports from app code were found during repository search.

Practical meaning:

- Treat this package as partially scaffolded infrastructure, not a proven shared contract layer.

### `packages/ui`

Observed:

- Contains a few sample components.
- No application imports from `@repo/ui` were found during repository search.

Practical meaning:

- Do not assume `packages/ui` is the source of truth for frontend UI. The actual app UI currently lives under `apps/web/components`.

## Domain Model

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

Core relationships:

- A `User` is a `customer`, `provider`, or `admin`.
- A provider user can own one `Provider` record and one `ProviderProfile`.
- Providers can publish many `Service` records.
- Customers create `ServiceRequest` records.
- Providers send `Quote` records against service requests.
- A `Booking` links to one accepted quote.
- A `Review` links to one booking.
- Messaging is conversation-based and can be attached to a service request.

## Primary Data Flows

### Customer request lifecycle

Observed:

1. Customer authenticates through `/api/auth/*`.
2. Customer creates a request through `POST /api/requests`.
3. Providers discover requests through provider endpoints.
4. Providers submit quotes through `POST /api/quotes`.
5. Customer accepts or rejects quotes through `POST /api/quotes/:id/respond`.

Important invariant:

- Accepting a quote currently updates quote state and request state to `in_progress`, but it does not automatically create a `Booking`.

This is a critical repository-specific constraint. Do not assume accepted quote equals booking unless you implement that path explicitly.

### Provider profile lifecycle

Observed:

- Providers are created through `POST /api/providers`.
- Public profile data is exposed through `GET /api/providers/:id/profile`.
- Provider self-service profile updates use `PUT /api/providers/me/profile`.

Important invariant:

- Public provider pages compose data from `Provider`, `ProviderProfile`, `User`, services, and recent completed bookings/reviews.

### Messaging lifecycle

Observed:

- REST endpoints live under `/api/messages/*`.
- WebSocket namespace is `/messages`.
- Frontend messaging pages currently use the REST controller and do not open socket connections.

Practical meaning:

- Backend realtime behavior exists, but frontend behavior is effectively request/response messaging today.
- Be careful not to document or promise live updates without wiring the frontend socket client.

### Upload lifecycle

Observed:

- Upload endpoints live under `/api/uploads/*`.
- Upload folders are segregated by purpose and user ID.
- Storage is implemented through an S3-compatible client.

Important invariant:

- File deletion is guarded by a path-prefix ownership check in `UploadsService`.

## External Dependencies

Observed and actively wired:

- PostgreSQL through Prisma
- JWT auth
- Swagger
- S3-compatible object storage for uploads

Observed but only partially wired or not clearly active:

- Redis is provisioned locally and in CI, but the cache module currently uses in-memory cache and does not use `REDIS_URL`.
- Meilisearch environment variables and dependency exist, but no search module or active search integration was found.
- Stripe fields exist in schema and env examples, but there is no payment module.
- SendGrid vars exist in env examples, but no email flow was found.
- Google Maps API key exists in env examples, but request creation currently sends `lat` and `lng` as `0`.

## Frontend Boundaries

Use these boundaries to keep changes safe:

- Keep HTTP access in `apps/web/lib/api.ts` rather than scattering raw `fetch` calls.
- Keep auth state changes inside `apps/web/contexts/AuthContext.tsx`.
- When adding UI copy, update both `apps/web/messages/en.json` and `apps/web/messages/de.json`.
- Respect App Router server/client boundaries. Many pages are async server components, but request creation, auth, dashboard pages, and messaging are client components.

## Backend Boundaries

Use these boundaries to keep changes safe:

- Add new route contracts through DTO -> controller -> service -> Prisma flow.
- Sanitize user-facing user objects. Existing code relies on select projections and `sanitizeUserResponse`.
- Keep Prisma schema, migrations, and seed data aligned when changing persistence.
- Treat `AuthModule`, `UsersModule`, `ProvidersModule`, `RequestsModule`, `QuotesModule`, `BookingsModule`, `MessagesModule`, and `UploadsModule` as high-impact modules.

## Critical Invariants

- All API routes are served under `/api`.
- JWT bearer auth is the default protection model for authenticated endpoints.
- The frontend stores auth tokens in `localStorage`.
- Locale selection is cookie-based, not path-based.
- Category and provider lists are expected to be locale-aware in presentation, but category records themselves store both German and English names.
- Public provider profile pages rely on data aggregation in backend service methods; changing those queries changes frontend behavior broadly.

## Danger Zones

### `apps/web/lib/api.ts`

Observed:

- This file centralizes most frontend/backend coupling.
- The current production build fails here because `API_URL` is referenced but not defined.

Implication:

- Seemingly small edits here can break large portions of the frontend.

### Prisma schema and migrations

Observed:

- Business state transitions depend on schema enums and relations.
- Seed data and many tests assume the current schema shape.

Implication:

- Schema changes are never "small". They require migration, seed, and verification updates.

### Auth and admin boundaries

Observed:

- Auth is JWT-based and shared across many modules.
- Admin routes are protected with `AdminGuard`.

Implication:

- Never silently change token semantics, guard application, or user response shape.

### Messaging

Observed:

- There is a split between REST and WebSocket implementations.

Implication:

- Changes can accidentally desynchronize message behavior between the API controller and gateway.

### Upload configuration

Observed:

- Code expects `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_URL`.
- `apps/api/.env.example` documents different key names.

Implication:

- Any upload-related work must confirm the intended env contract before rollout.

## Safe Change Guidelines

Safe, lower-risk changes usually include:

- Isolated page presentation updates in `apps/web/components/*`
- Translation-only updates when both locale files are updated together
- New backend read-only endpoints that follow existing DTO/controller/service patterns
- Small fixes inside a single domain service with matching test updates

Higher-risk changes that should trigger deeper review:

- Anything in `apps/web/lib/api.ts`
- Changes to auth, token storage, or route protection
- Changes to Prisma enums or relations
- Changes that alter request/quote/booking state transitions
- Upload storage changes
- Admin reporting or approval logic
- Global config changes in root scripts, root tsconfig, or CI

## Architectural Entropy And Unknowns

Observed:

- Root `package.json` contains a `dev:mobile` script, but no mobile workspace exists.
- Root `tsconfig.json` extends Expo config, but no Expo app exists.
- `ServicesModule` and `ReviewsModule` are placeholder modules.
- CI contains Playwright and deploy steps that do not match the current repository contents.

Unknown:

- Intended production deployment target
- Intended search architecture
- Intended payments implementation
- Intended email provider integration
- Whether `packages/shared` and `packages/ui` are meant to become active dependencies soon or remain scaffolding

Needs confirmation before making broad changes:

- Whether to remove stale mobile/Expo scaffolding
- Whether to fix CI to current reality or preserve it for a hidden roadmap
- Whether uploads should target AWS S3, Cloudflare R2, or another compatible provider in production
