# Mobile App

Expo Router client, developed on `claude/zen-gauss-tazw97`. The native-versus-WebView decision (ARM-30) is made: this is a thin native shell around `apps/web`, not a native rewrite.

## Purpose

Observed responsibilities:

- native login/register and session storage (`expo-secure-store`, not the browser's `localStorage`)
- a `WebView` around `apps/web` for everything else a signed-in user does
- a two-way auth bridge so the native session and the WebView's web session stay in sync
- Expo push notifications for quote/booking/request events, with tap-to-deep-link into the right web page
- a native fallback screen when the WebView can't reach the API/web

## Important Files

- `app/(auth)/login.tsx`, `register.tsx`: native auth screens, call `apps/api` directly
- `app/(app)/web.tsx`: the WebView screen; owns the auth-sync script injection, the native/web message bridge, and the offline fallback
- `src/providers/SessionProvider.tsx`: session state, `expo-secure-store` persistence, push token registration on sign-in/out
- `src/lib/api.ts`: native auth + push-token API client
- `src/lib/routing.ts`: web URL helpers, the auth-sync script, and `resolveNotificationPath` (push → web path mapping)
- `src/lib/push.ts`: push permission request, Expo push token registration/unregistration
- `src/components/NotificationResponseHandler.tsx`: navigates into the WebView when a push notification is tapped (cold start or foreground)
- `src/components/WebViewError.tsx`: the offline/connection-error screen

## The Auth Bridge

This is the part most likely to break silently if only one side changes:

- native → web: on load, `src/lib/routing.ts#buildAuthSyncScript` injects the session into the WebView's `localStorage` under the same keys `apps/web/contexts/AuthContext.tsx` uses
- web → native: `apps/web/lib/native-bridge.ts` posts `auth-state`/`route-change` messages via `window.ReactNativeWebView.postMessage`; `app/(app)/web.tsx`'s `onMessage` handler turns those back into `SessionProvider` updates

A change to the message shape or the token-storage keys needs both sides updated together.

## Run Locally

From the repository root:

```bash
npm run dev:mobile
```

Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` first — see `.env.example`.

Expo Go cannot receive push notifications (unsupported since SDK 53). Use an EAS development build (`eas build --profile development`) to test that part.

## Validation

- `npm run lint`: passes
- `npm run check-types`: passes
- there is no `build` or `test` script; Expo apps build through `eas build`, and there is no automated test suite yet

## Not Ready Yet

- app icon/splash, and a final app name decision (`app.json` currently says "Workify Germany", the rest of the repo says "Armut Germany")
- EAS submit credentials (App Store Connect / Play Console) and push credentials (an APNs key, an FCM project) — without these, push will not deliver from a production/EAS build
- Universal Links/App Links, so a Stripe Checkout/Connect redirect currently opens in the system browser instead of returning to the app
- push for new chat messages — messaging bypasses `NotificationsService` via its own Socket.IO gateway, so it isn't covered by the existing push fan-out

## Safe Change Notes

- Prefer letting the WebView cover a flow over building it natively; native code is for auth, push, and session handoff
- Keep `src/lib/routing.ts#resolveNotificationPath` in sync by hand with `apps/api`'s `NotificationsService` payloads
- See [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#mobile) and [`docs/ENVIRONMENT.md`](../../docs/ENVIRONMENT.md) for more detail
