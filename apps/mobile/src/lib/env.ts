import Constants from "expo-constants";

const DEFAULT_API_ORIGIN = "http://localhost:4000";
const DEFAULT_API_PORT = "4000";

function extractHost(candidate?: string | null) {
  if (!candidate) return null;

  try {
    if (candidate.startsWith("exp://")) {
      return new URL(candidate.replace("exp://", "http://")).hostname;
    }

    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      return new URL(candidate).hostname;
    }
  } catch {
    return null;
  }

  const sanitized = candidate.replace(/^\/+/, "");
  return sanitized.split(":")[0]?.split("/")[0] || null;
}

function inferExpoHost() {
  const fromExpoConfig = extractHost(Constants.expoConfig?.hostUri);
  if (fromExpoConfig) return fromExpoConfig;

  const fromLinkingUri = extractHost(Constants.linkingUri);
  if (fromLinkingUri) return fromLinkingUri;

  return null;
}

export function getApiOrigin() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const host = inferExpoHost();
  if (host) {
    return `http://${host}:${DEFAULT_API_PORT}`;
  }

  return DEFAULT_API_ORIGIN;
}
