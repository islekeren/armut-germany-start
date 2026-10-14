import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { notificationsApi } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests permission and returns an Expo push token for this device, or
 * null when push isn't available (simulators/emulators, denied permission).
 * Never throws: push registration must not block sign-in.
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  try {
    if (!Device.isDevice) {
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== "granted") {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      return null;
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

function getPushPlatform(): "ios" | "android" | null {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return Platform.OS;
  }
  return null;
}

/**
 * Registers this device for push on the backend for the signed-in user.
 * Best-effort and silent: a denied permission or offline API must not
 * disrupt sign-in.
 */
export async function syncPushTokenForSession(
  accessToken: string,
): Promise<void> {
  try {
    const platform = getPushPlatform();
    const expoPushToken = await registerForPushNotificationsAsync();

    if (!platform || !expoPushToken) {
      return;
    }

    await notificationsApi.registerPushToken(accessToken, {
      token: expoPushToken,
      platform,
    });
  } catch {
    // Best-effort: push registration must never block sign-in.
  }
}

/** Unregisters this device's push token on sign-out. Best-effort. */
export async function clearPushTokenForSession(
  accessToken: string,
): Promise<void> {
  try {
    const expoPushToken = await registerForPushNotificationsAsync();
    if (!expoPushToken) {
      return;
    }

    await notificationsApi.unregisterPushToken(accessToken, expoPushToken);
  } catch {
    // Best-effort: sign-out must still complete locally.
  }
}
