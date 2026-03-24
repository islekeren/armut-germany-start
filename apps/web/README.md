# Web App

## Purpose

`apps/web` is the Next.js frontend for the marketplace.

Observed responsibilities:

- public landing and category discovery pages
- customer auth and request creation
- customer request management and messaging
- provider dashboard, profile management, reviews, calendar, and messages
- locale-aware UI using German and English message files

## Run Locally

From this directory:

```bash
npm run dev
```

From the repository root, `npm run dev` starts this app together with the API.
`npm run dev` uses Webpack mode because the default Next 16 Turbopack dev server currently hangs on `/` in this repository.
If you want to compare behavior, `npm run dev:turbo` still starts the Turbopack dev server.

Default local URL:

- `http://localhost:3000`

## Important Files

- `app/`: App Router routes
- `components/`: app-local reusable UI components
- `contexts/AuthContext.tsx`: auth state and token persistence
- `lib/api.ts`: frontend API client and typed request helpers
- `messages/en.json`, `messages/de.json`: translation dictionaries
- `next.config.js`: API rewrite and `next-intl` setup

## Key Route Groups

- `(auth)`: login, register, provider onboarding
- `(customer)`: customer messages and request pages
- `(provider)`: provider dashboard pages
- public routes: homepage, categories, category detail, provider public profiles, create-request

## Validate

```bash
npm run lint
npm run check-types
npm run build
```

Important baseline status:

- lint currently fails on an unused helper warning
- type-check currently fails because `.next/types/cache-life.d.ts` is missing
- production build currently fails because `lib/api.ts` references an undefined `API_URL` variable

See `../../TESTING.md` for details.

## Safe Change Notes

- Keep API access centralized in `lib/api.ts`.
- Keep auth behavior inside `contexts/AuthContext.tsx`.
- Update both locale files when adding or changing user-visible text.
- Respect server/client component boundaries when moving code.

## Known Gaps

- No frontend unit tests found
- No Playwright tests found
- Messaging UI is REST-based even though the backend exposes a websocket gateway
- Several provider dashboard links point to pages that are not implemented
