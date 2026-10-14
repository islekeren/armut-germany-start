import type { StoredSession } from "../providers/SessionProvider";

const DEFAULT_WEB_URL = "http://localhost:3000";

export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_URL;

export function getSingleParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function getDefaultWebPath(userType: StoredSession["user"]["userType"]) {
  return userType === "provider" ? "/dashboard" : "/";
}

export function getProviderOnboardingPath() {
  return "/provider-onboarding?mode=complete-profile";
}

export function getRedirectFromAuthPath(path: string) {
  const url = new URL(path, WEB_URL);
  return url.searchParams.get("redirect") || undefined;
}

export function getAuthScreenForPath(path: string) {
  return path.startsWith("/register") ? "/(auth)/register" : "/(auth)/login";
}

export function isInternalWebUrl(url: string) {
  try {
    const current = new URL(url);
    return current.origin === new URL(WEB_URL).origin;
  } catch {
    return false;
  }
}

/**
 * Maps a push notification's data payload (the notification `type` plus
 * the backend's metadata: bookingId, requestId, audience, ...) to the web
 * path to open. Mirrors apps/api's NotificationsService payloads; keep in
 * sync when a new notification type is added there.
 */
export function resolveNotificationPath(
  data: Record<string, unknown>,
): string | null {
  const bookingId = typeof data.bookingId === "string" ? data.bookingId : undefined;
  if (bookingId) {
    // Booking detail pages are split by audience: /bookings/[id] is the
    // customer-only route (its layout bounces any other user type away),
    // providers see the same booking through the orders list instead.
    return data.audience === "provider"
      ? `/dashboard/orders?booking=${bookingId}`
      : `/bookings/${bookingId}`;
  }

  const type = typeof data.type === "string" ? data.type : undefined;
  if (type === "quote_accepted") {
    return "/dashboard/offers";
  }

  const requestId = typeof data.requestId === "string" ? data.requestId : undefined;
  if (requestId) {
    const audience = data.audience === "provider" ? "provider" : "customer";
    return audience === "provider"
      ? `/dashboard/requests/${requestId}`
      : `/my-requests/${requestId}`;
  }

  return null;
}

export function buildAuthSyncScript(session: StoredSession) {
  return `
    (function () {
      localStorage.setItem("armut_access_token", ${JSON.stringify(session.accessToken)});
      localStorage.setItem("armut_refresh_token", ${JSON.stringify(session.refreshToken)});
      localStorage.setItem("armut_user", ${JSON.stringify(JSON.stringify(session.user))});
      window.dispatchEvent(new CustomEvent("armut-auth-sync"));
      true;
    })();
  `;
}
