# Project Gap Report (Web + API)

## Scope
- Repository: `armut-germany-start`
- Focus: frontend route coverage, incomplete product flows, backend risks, and practical delivery gaps
- Verified on: 2026-03-17
- Verification basis: code inspection across `apps/web` and `apps/api`, plus current lint/typecheck/test runs

## Executive Summary
- The report from 2026-03-01 is partially outdated.
- Several important items are now fixed: API-driven categories, dynamic unread badge, customer bookings pages, quote-to-booking UI flow, provider approval admin guard, and provider distance-filter pagination.
- The largest remaining issues are still broken route links, missing static/legal/help pages, incomplete geolocation/search/filtering, placeholder provider actions, missing realtime frontend messaging, missing payments APIs, and missing frontend tests.
- Security is improved, but user response payloads should still be tightened further before this area is considered fully complete.

## Confirmed Missing Routes
- `/dashboard/orders`
- `/dashboard/finances`
- `/dashboard/settings`
- `/dashboard/services`
- `/help`
- `/pricing`
- `/success-stories`
- `/forgot-password`
- `/imprint`
- `/privacy`
- `/terms`

## Fixed Since The Previous Report
- Customer requests page no longer falls back to hardcoded mock cards when auth/API data is unavailable.
- Create-request categories are loaded from the categories API instead of being hardcoded in the UI.
- Provider dashboard unread message badge is now dynamic.
- Customer quote acceptance now leads into a booking creation flow in the UI.
- Customer booking list, booking creation, and booking detail pages now exist and use bookings endpoints.
- Provider onboarding and profile persistence are substantially improved for core fields such as address, phone, email, website, pricing, and categories.
- Provider approval endpoint is now protected by `JwtAuthGuard` and `AdminGuard`.
- Provider listing pagination/meta now matches the distance-filtered result set.
- Older route typos noted in the previous report are no longer present:
  `/dashboard/profil`, `/anmelden`, `/passwort-vergessen`.

## Still Missing Or Incomplete
- Broken route links still point to pages that do not exist.
- Root `README.md` still documents "Customer Mock Data Credentials" even though the customer request flow no longer uses the old fallback strategy.
- Request creation geolocation is still incomplete and still sends `lat/lng` as `0`.
- Provider onboarding also still uses `serviceAreaLat/serviceAreaLng = 0`.
- Category page filter and sort controls are still visual only and are not wired to real query behavior.
- Homepage search box is still visual only.
- Provider profile image and gallery upload UI is still not connected to the uploads API.
- Provider calendar action buttons are still placeholders.
- Customer request detail still has a placeholder `Edit` action.
- Frontend messaging still uses REST-only fetch/send flows and does not use the existing websocket backend for live updates.
- Message composer is still text-only and does not expose attachment upload despite upload endpoints/helpers existing.
- Payments are still modeled in Prisma, but there is no dedicated payments module/controller/service flow in the Nest app.
- `ServicesModule` and `ReviewsModule` are still empty placeholder modules.
- Frontend tests are still missing.
- Locale-safe route coverage for auth/help/legal/support pages is still incomplete.

## Gap Review By Area

### 1) Frontend Mock / Hardcoded Data
- Fixed: customer requests mock fallback removed.
- Fixed: create-request categories now come from API.
- Fixed: provider dashboard message badge now uses unread count API.
- Open: root README still references customer mock data.

### 2) Missing Or Incomplete Functionality
- Open: multiple navigation and CTA links still resolve to missing pages.
- Fixed: quote -> accepted -> booking flow now exists in the customer UI.
- Fixed: customer booking pages are implemented against real bookings endpoints.
- Mostly fixed: provider onboarding/profile persistence for core business/contact/location data.
  Remaining gap: media upload UX is still not wired.
- Partially fixed: request page now uses real data and explicit error handling, but still lacks a dedicated empty state UX.
- Open: geolocation flow remains unfinished.
- Open: homepage search behavior is not implemented.
- Open: category filters/sorting are not implemented.
- Open: provider calendar/request-detail placeholder actions remain.
- Open: realtime socket integration is not used by the frontend.
- Open: payments flow is not implemented.

### 3) Backend Risks
- Partially fixed: `/users/:id` access is now restricted to self/admin and raw password exposure is no longer present through `UsersService.findById`.
  Remaining concern: the shared user response still includes fields such as `email`, `phone`, `gdprConsent`, `createdAt`, and `updatedAt`, which may be broader than necessary for every caller.
- Fixed: provider approval endpoint now has admin-only authorization.
- Fixed: provider pagination/meta now aligns with distance filtering.
- Open: empty placeholder modules remain in the backend.

## TODO List (Updated)

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
- [ ] Wire provider calendar action buttons and related appointment flows.
- [ ] Add realtime socket integration to messaging UI (new message, typing, read events).
- [ ] Add message attachment support in the frontend composer.
- [ ] Implement payments module/API (charge, status updates, payout-ready data).
- [ ] Complete geolocation/geocoding for request and provider service area flows.

### P3 (Cleanup & Quality)
- [ ] Remove or implement placeholder backend modules (`ServicesModule`, `ReviewsModule`).
- [ ] Add frontend tests for key flows (auth, request creation, quote acceptance, bookings, messaging).
- [ ] Update README to reflect current non-mock behavior and real test flows.
- [ ] Standardize locale-safe routes for auth/help/legal/support pages.

## Validation Snapshot
- `npm --prefix apps/web run check-types`: passed on 2026-03-17
- `npm --prefix apps/web run lint`: passed on 2026-03-17
- `npm.cmd --prefix apps/api run test -- --runInBand`: 26 of 27 suites passed on 2026-03-17

## Current Test Failure
- `apps/api/src/modules/categories/categories.service.spec.ts`
- Failure cause: the test still expects the old Prisma query shape and does not account for the added `_count.services` include used by `CategoriesService.findAll()`.
- Impact: this is a test expectation mismatch, not evidence that the categories feature is broken in production code.

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
