# API App

Updated for the repository state audited on April 10, 2026.

## Purpose

`apps/api` is the NestJS 11 backend for the marketplace.

Observed responsibilities:

- auth and user identity
- providers and public provider profiles
- categories and service requests
- quotes and bookings
- customer/provider messaging
- uploads
- notifications
- admin endpoints

## Important Files

- `src/app.module.ts`: module registration
- `src/main.ts`: bootstrap, CORS, validation, Swagger, and global prefix
- `prisma/schema.prisma`: database schema
- `prisma/seed.ts`: development seed data
- `src/common/*`: Prisma, cache, throttle, and security helpers

## API Surface

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

Swagger:

- `http://localhost:4000/api/docs`

## Run Locally

From this directory:

```bash
npm run dev
```

Useful setup commands:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Validation

Observed on April 10, 2026:

- `npm run lint`: passes with 15 warnings
- `npm run check-types`: passes
- `npm run build`: passes
- `npm run test -- --watchman=false`: passes
- `npm run test:e2e -- --watchman=false`: passes outside the sandbox

Environment caveat:

- in restricted environments, the e2e suite can fail with `EPERM` when Supertest tries to bind a local server

## Current Implementation Notes

- all routes live under `/api`
- JWT bearer auth is the default protection model
- notifications are a real module, not scaffold-only
- accepted quotes still require a separate booking creation call
- cache currently uses in-memory Nest cache, not Redis

## Known Gaps

- `ServicesModule` is still an empty shell
- `ReviewsModule` is still an empty shell
- a `Payment` model exists in Prisma, but no payments module was found
- upload env names in `.env.example` do not match the names expected by `UploadsService`

## Safe Change Notes

- Preserve DTO validation and guards
- Sanitize user responses
- Treat schema changes as high-impact work that requires migration and seed alignment
- Re-run API tests when changing controller wiring, auth, or request/booking/quote state transitions
