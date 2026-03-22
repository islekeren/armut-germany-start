# Project Gap Report (Web + API)

## Not implemented routes:

- `/dashboard/orders`
- `/dashboard/finances`
- `/dashboard/settings`
- `/dashboard/services`
- `/help`
- `/pricing`
- `/success-stories`

## Scope
- Repository: `armut-germany-start`
- Focus: frontend mock data, missing functionality, and practical missing pieces
- Date: 2026-03-01

## Current State Summary
- Core modules exist and many screens are API-connected.
- Several user journeys are still partial due to mock fallback behavior, dead links, and placeholder actions.
- A few backend issues should be treated as high priority (security + authorization).

## Key Gaps

### 1) Frontend Mock/Hardcoded Data
- Customer requests page still uses fallback mock cards when unauthenticated/API error.
- Create-request category source is hardcoded in UI instead of fetched dynamically.
- Provider dashboard message badge is hardcoded.
- Root README still documents customer pages as “mock data”.

### 2) Missing or Incomplete Functionalities
- Multiple links point to missing pages (`/dashboard/orders`, `/dashboard/finances`, `/dashboard/settings`, `/dashboard/services`, etc.).
- Quote acceptance does not complete booking creation flow in UI.
- Provider onboarding/profile forms collect data that is not fully persisted.
- Geolocation flow is incomplete (`lat/lng` sent as `0`).
- Category filters/sorting UI is present but not wired to real filtering logic.
- Homepage search box is visual only (no behavior).
- Some UI actions are placeholders (edit request, set availability, add appointment, details buttons).
- Realtime messaging backend exists, but frontend uses REST-only flow and no live socket updates.
- Payments domain exists in schema, but no payment module/API flow is implemented.

### 3) Backend Risks
- User data exposure risk: user fetch routes/services can return full user objects.
- Provider approve endpoint lacks admin-only guard.
- Provider distance filtering is applied after pagination, causing inconsistent totals/pages.
- Empty placeholder modules still present (`ServicesModule`, `ReviewsModule`).

## TODO List (Prioritized)

### P0 (Do First)
- [ ] Fix all broken/dead route links and typos in frontend navigation.
- [ ] Align provider list pagination/meta with distance filtering logic.

### P1 (Core Product Completion)
- [ ] Persist all provider onboarding/profile fields (address, phone, website, etc.).
- [ ] Replace hardcoded create-request categories with API-driven categories.
- [ ] Replace request mock fallback strategy with explicit empty/error states.

### P2 (Feature Depth)
- [ ] Implement homepage search behavior and category page real filters/sorting.
- [ ] Wire provider profile image/gallery upload to uploads API.
- [ ] Wire provider calendar action buttons (availability, appointment actions).
- [ ] Add realtime socket integration to messaging UI (new message, typing, read events).
- [ ] Implement payments module/API (charge, status updates, payout-ready data).

### P3 (Cleanup & Quality)
- [ ] Remove or implement placeholder backend modules (`ServicesModule`, `ReviewsModule`).
- [ ] Add frontend tests for key flows (auth, request creation, quote acceptance, messaging).
- [ ] Update README to reflect current non-mock behavior and real test flows.
- [ ] Standardize locale-safe routes for auth/help/legal pages.

## Suggested Delivery Order
- Sprint 1: P0 security + broken links.
- Sprint 2: P1 booking lifecycle + onboarding/profile persistence.
- Sprint 3: P2 search/filters + realtime messaging + uploads polish.
- Sprint 4: P2 payments + P3 cleanup/testing/docs.



1) Frontend mock/hardcoded data still present DONE

- Customer requests still fallback to hardcoded mock cards (mockRequests) when token is missing or API fails in my-requests/page.tsx:25, my-requests/page.tsx:116, my-requests/page.tsx:129.
- Create-request categories are hardcoded in UI instead of loaded from API in create-request/page.tsx:22.
- Provider dashboard message badge is hardcoded 3 in dashboard/page.tsx:88.
- Root README still documents “Customer Mock Data” in README.md:15.

2) Missing or incomplete functionality

- Route/link integrity is incomplete: app links to routes that do not exist under apps/web/app, e.g. /dashboard/orders, /dashboard/finances, /dashboard/settings, /dashboard/services in dashboard/page.tsx:132, dashboard/page.tsx:164, dashboard/page.tsx:180, dashboard/page.tsx:333, 
plus /dashboard/profil typo in Header.tsx:89(Done), /passwort-vergessen in login/page.tsx:100(done but missing forgot password route), /anmelden in register/page.tsx:244(done), /hilfe /preise /erfolgsgeschichten in app/page.tsx:142, app/page.tsx:149, app/page.tsx:150(done but not implemented).



- Quote acceptance does not create a booking lifecycle step: frontend accepts quote in request-detail/page.tsx:153, backend only updates quote/request status in quotes.service.ts:304, while full booking endpoints exist in bookings.controller.ts:27.
- Provider onboarding/profile data loss: onboarding collects address/phone etc in provider-onboarding/page.tsx:17 but submit payload omits most of it in provider-onboarding/page.tsx:190; profile form edits contact/email/phone in provider-profile/page.tsx:21 but save payload in provider-profile/page.tsx:97 does not persist those user fields.
- Geo/location flow is unfinished: request creation sends lat/lng = 0 in create-request/page.tsx:102, create-request/page.tsx:103.
Provider profile image/gallery UI is placeholder (“Change image” button no upload action) in provider-profile/page.tsx:340.
Category page filters/sorting UI is present but not wired to query state in category/[slug]/page.tsx:155, category/[slug]/page.tsx:185, category/[slug]/page.tsx:197.
- Homepage search UI has no search behavior attached in app/page.tsx:30.
- Calendar and request detail contain placeholder actions (no handlers): calendar/page.tsx:122, calendar/page.tsx:251, calendar/page.tsx:268, request-detail/page.tsx:299.
- Realtime messaging exists in backend websocket gateway messages.gateway.ts:19, but frontend uses REST polling only customer-messages/page.tsx:70, and composer is text-only (no attachments) in MessagesWorkspace.tsx:178.
- ServicesModule and ReviewsModule are empty placeholders in services.module.ts:3, reviews.module.ts:3.
- Payments are modeled in DB (schema.prisma:270) but there is no payments module/controller in app.module.ts:20.

3) Important backend risks DONE
Sensitive user exposure risk: findById returns full user record in users.service.ts:8, and controller exposes it from /users/profile and /users/:id in users.controller.ts:20, users.controller.ts:35.
Provider approval endpoint lacks admin guard in providers.controller.ts:121.
Provider listing pagination/meta accuracy issue: distance filtering happens after DB pagination in providers.service.ts:224 and providers.service.ts:254, but total is counted pre-distance in providers.service.ts:268.
