# API App

## Purpose

`apps/api` is the NestJS backend for the marketplace.

Observed responsibilities:

- auth and user identity
- provider profiles and provider dashboard data
- categories, service requests, quotes, bookings, and reviews
- customer/provider messaging
- uploads
- admin endpoints

## Run Locally

From this directory:

```bash
npm run dev
```

Useful companion steps:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Build And Validate

```bash
npm run check-types
npm run build
npm run test -- --watchman=false
npm run test:e2e -- --watchman=false
```

Important:

- Unit tests are close to usable but currently have 1 stale failing assertion.
- E2E tests are stale and do not match the current module surface.

See `../../TESTING.md` for the exact baseline status.

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

Swagger:

- `http://localhost:4000/api/docs`

## Important Files

- `src/app.module.ts`: module registration
- `src/main.ts`: app bootstrap, CORS, validation, Swagger
- `prisma/schema.prisma`: database schema
- `prisma/seed.ts`: local test data

## Known Gaps

- `ServicesModule` and `ReviewsModule` are placeholders.
- Payments exist in the schema but not as an implemented backend module.
- Search-related e2e tests exist, but no search module is registered.
- Upload env vars in code and `.env.example` do not currently match.

## Safe Change Notes

- Preserve DTO validation and auth guards.
- Sanitize user responses.
- Treat schema changes as high-impact work that requires migration and seed updates.
