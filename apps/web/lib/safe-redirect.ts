/**
 * Returns `value` only when it is a same-site path (e.g. "/create-request?x=1").
 * Anything else — absolute URLs, protocol-relative "//host", backslash tricks —
 * falls back, so a crafted ?redirect= cannot send users to another site.
 */
export function getSafeRedirect(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (value.includes("\\")) {
    return fallback;
  }

  return value;
}
