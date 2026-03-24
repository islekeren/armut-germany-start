import type { User } from "@/lib/api";

export const WEB_AUTH_SYNC_EVENT = "armut-auth-sync";

export type NativeBridgeMessage =
  | {
      type: "auth-state";
      payload:
        | {
            isAuthenticated: true;
            accessToken: string;
            refreshToken: string;
            user: User;
          }
        | {
            isAuthenticated: false;
            accessToken: null;
            refreshToken: null;
            user: null;
          };
    }
  | {
      type: "route-change";
      payload: {
        path: string;
      };
    };

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

function postNativeBridgeMessage(message: NativeBridgeMessage) {
  if (typeof window === "undefined") {
    return;
  }

  const bridge = window.ReactNativeWebView;
  if (!bridge) {
    return;
  }

  try {
    bridge.postMessage(JSON.stringify(message));
  } catch {
    // Ignore bridge transport failures in the browser or unsupported shells.
  }
}

export function emitAuthStateMessage(
  payload: Extract<NativeBridgeMessage, { type: "auth-state" }>["payload"],
) {
  postNativeBridgeMessage({
    type: "auth-state",
    payload,
  });
}

export function emitRouteChangeMessage(path: string) {
  postNativeBridgeMessage({
    type: "route-change",
    payload: { path },
  });
}
