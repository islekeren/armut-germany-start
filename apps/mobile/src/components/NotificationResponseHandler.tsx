import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { getDefaultWebPath, resolveNotificationPath } from "../lib/routing";
import { useSession } from "../providers/SessionProvider";

/** Navigates into the web view when a push notification is tapped. */
export function NotificationResponseHandler() {
  const { session } = useSession();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        if (!session) {
          return;
        }

        const data = response.notification.request.content.data as Record<
          string,
          unknown
        >;
        const path = resolveNotificationPath(data) ?? getDefaultWebPath(session.user.userType);

        router.push({ pathname: "/(app)/web", params: { path } });
      },
    );

    return () => subscription.remove();
  }, [session]);

  return null;
}
