# Web App

Updated for the repository state audited on April 10, 2026.

## Purpose

`apps/web` is the Next.js 16 frontend for the marketplace.

Observed responsibilities:

- public landing and category discovery pages
- customer auth, request, booking, message, and notification flows
- provider dashboard flows for requests, orders, calendar, messages, profile, and reviews
- locale-aware UI using `next-intl`

## Important Files

- `app/`: App Router pages
- `components/`: app-local UI components
- `contexts/AuthContext.tsx`: auth state and token persistence
- `lib/api.ts`: frontend API client and typed request helpers
- `lib/bookings.ts`: booking display helpers
- `messages/en.json`, `messages/de.json`: translation dictionaries
- `next.config.js`: rewrite config and `next-intl` setup

## Route Shape

Observed route groups:

- `(auth)`: `/login`, `/register`, `/provider-onboarding`
- `(customer)`: `/customer-dashboard`, `/my-requests`, `/bookings`, `/messages`, `/settings`
- `(provider)`: `/dashboard`, `/dashboard/requests`, `/dashboard/offers`, `/dashboard/orders`, `/dashboard/calendar`, `/dashboard/listings`, `/dashboard/profile`, `/dashboard/reviews`, `/dashboard/messages`, `/dashboard/settings`, `/dashboard/services`, `/dashboard/finances`
- public: `/`, `/categories`, `/category/[slug]`, `/find-providers`, `/providers/[id]`, `/create-request`, `/become-provider`, `/how-it-works`, `/requests`, `/notifications`

Fallback route:

- `app/[slug]/page.tsx` serves generic coming-soon pages for routes like `help`, `pricing`, `success-stories`, `privacy`, and `terms`

## Run Locally

From this directory:

```bash
npm run dev
```

Default local URL:

- `http://localhost:3000`

The web app expects `API_URL` and `NEXT_PUBLIC_API_URL`. See [`ENVIRONMENT.md`](../../ENVIRONMENT.md).

## Validation

Observed on April 10, 2026:

- `npm run lint`: passes
- `npm run build`: passes
- `npm run check-types`: passes in the current workspace after `.next/types` exists

Fresh-checkout caveat:

- `npm run check-types` can fail until `.next/types/cache-life.d.ts` exists
- if that happens, run `npm run build` once and retry

## Current Implementation Notes

- Auth tokens are stored in `localStorage`
- frontend/backend coupling is intentionally centralized in `lib/api.ts`
- customer quote acceptance redirects to `/bookings/new` because booking creation is still a separate step
- notifications are implemented as a real page and API flow
- provider `services` and `finances` pages still render placeholder content

## Safe Change Notes

- Keep API access centralized in `lib/api.ts`
- Keep auth behavior inside `contexts/AuthContext.tsx`
- Update both locale files when user-facing text changes
- Respect client/server component boundaries when moving logic around
