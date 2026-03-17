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
- [ ] Tighten user response payloads so every user-facing endpoint returns only the minimum necessary fields.
- [x] Add admin authorization guard to provider approval endpoint.
- [ ] Fix all broken/dead route links and add the missing referenced pages.
- [x] Align provider list pagination/meta with distance filtering logic.

### P1 (Core Product Completion)
- [x] Complete quote -> accepted -> booking flow in customer UI.
- [x] Add customer booking pages using existing bookings endpoints.
- [ ] Finish the remaining provider profile/onboarding gaps, especially media uploads and any non-core profile fields still not surfaced in the UI.
- [x] Replace hardcoded create-request categories with API-driven categories.
- [ ] Finish replacing old mock-era fallback behavior with polished empty/error states across customer request flows.

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
- Sprint 1: dead links and missing static/legal/help pages, plus user response payload tightening.
- Sprint 2: geolocation completion, homepage search, and category filters/sorting.
- Sprint 3: provider media uploads, calendar action flows, and realtime messaging integration.
- Sprint 4: payments, cleanup of placeholder modules, frontend tests, and documentation refresh.
