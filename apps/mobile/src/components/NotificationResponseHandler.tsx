import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { getDefaultWebPath, resolveNotificationPath } from "../lib/routing";
import { useSession } from "../providers/SessionProvider";

/**
 * Navigates into the web view when a push notification is tapped, whether
 * that happens while the app is running or is what launched it (cold
 * start). useLastNotificationResponse covers both: it keeps returning the
 * same response until cleared, so handledIdentifierRef guards against
 * re-navigating on every re-render or remount.
 */
export function NotificationResponseHandler() {
  const { session } = useSession();
  const response = Notifications.useLastNotificationResponse();
  const handledIdentifierRef = useRef<string | null>(null);

  useEffect(() => {
    if (!response || !session) {
      return;
    }

    const identifier = response.notification.request.identifier;
    if (handledIdentifierRef.current === identifier) {
      return;
    }
    handledIdentifierRef.current = identifier;

    const data = response.notification.request.content.data as Record<
      string,
      unknown
    >;
    const path = resolveNotificationPath(data) ?? getDefaultWebPath(session.user.userType);

    router.push({ pathname: "/(app)/web", params: { path } });
    void Notifications.clearLastNotificationResponseAsync();
  }, [response, session]);

  return null;
}
