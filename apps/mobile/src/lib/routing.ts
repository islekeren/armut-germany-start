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
