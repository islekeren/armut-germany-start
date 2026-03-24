import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  buildAuthSyncScript,
  getAuthScreenForPath,
  getDefaultWebPath,
  getRedirectFromAuthPath,
  getSingleParam,
  isInternalWebUrl,
  WEB_URL,
} from "../../src/lib/routing";
import {
  type StoredSession,
  type WebBridgeMessage,
  useSession,
} from "../../src/providers/SessionProvider";

export default function WebScreen() {
  const params = useLocalSearchParams<{ path?: string }>();
  const { session, signOut, syncSessionFromWeb } = useSession();
  const webViewRef = useRef<WebView>(null);
  const hasBootstrappedAuthRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const currentPath =
    getSingleParam(params.path) ||
    getDefaultWebPath(session?.user.userType ?? "customer");
  const initialUrl = `${WEB_URL}${currentPath}`;
  const authSyncScript = session ? buildAuthSyncScript(session) : "";

  const syncAuthIntoWebView = useCallback(() => {
    if (!authSyncScript) {
      return;
    }

    if (hasBootstrappedAuthRef.current) {
      return;
    }

    webViewRef.current?.injectJavaScript(authSyncScript);
  }, [authSyncScript]);

  useEffect(() => {
    if (!authSyncScript) {
      return;
    }

    hasBootstrappedAuthRef.current = false;
    webViewRef.current?.injectJavaScript(authSyncScript);
  }, [authSyncScript]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (!canGoBack) {
            return false;
          }

          webViewRef.current?.goBack();
          return true;
        },
      );

      return () => {
        subscription.remove();
      };
    }, [canGoBack]),
  );

  if (!session) {
    return null;
  }

  async function moveToNativeAuth(path: string) {
    const screen = getAuthScreenForPath(path);
    const redirect = getRedirectFromAuthPath(path);

    await signOut({ remote: false });

    router.replace({
      pathname: screen,
      params: redirect ? { redirect } : undefined,
    });
  }

  async function handleMessage(event: WebViewMessageEvent) {
    let message: WebBridgeMessage | null = null;

    try {
      message = JSON.parse(event.nativeEvent.data) as WebBridgeMessage;
    } catch {
      return;
    }

    if (message.type === "auth-state") {
      const payload = message.payload;
      hasBootstrappedAuthRef.current = payload.isAuthenticated;
      const nextSession: StoredSession | null = payload.isAuthenticated
        ? {
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            user: payload.user,
          }
        : null;

      await syncSessionFromWeb(nextSession);

      if (!payload.isAuthenticated) {
        await moveToNativeAuth("/login");
      }
      return;
    }

    if (message.type === "route-change") {
      const nextPath = message.payload.path;
      if (
        !hasBootstrappedAuthRef.current &&
        (nextPath.startsWith("/login") || nextPath.startsWith("/register"))
      ) {
        syncAuthIntoWebView();
      }
    }
  }

  function handleShouldStartLoad(request: { url: string }) {
    if (!isInternalWebUrl(request.url)) {
      void Linking.openURL(request.url);
      return false;
    }

    const url = new URL(request.url);
    const nextPath = `${url.pathname}${url.search}`;

    if (
      !hasBootstrappedAuthRef.current &&
      (nextPath.startsWith("/login") || nextPath.startsWith("/register"))
    ) {
      syncAuthIntoWebView();
    }

    return true;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <WebView
        ref={webViewRef}
        allowsBackForwardNavigationGestures
        source={{ uri: initialUrl }}
        domStorageEnabled
        injectedJavaScriptBeforeContentLoaded={authSyncScript}
        javaScriptEnabled
        onLoadEnd={syncAuthIntoWebView}
        onMessage={handleMessage}
        onNavigationStateChange={(navigationState) => {
          setCanGoBack(navigationState.canGoBack);

          if (!isInternalWebUrl(navigationState.url)) {
            return;
          }

          const url = new URL(navigationState.url);
          const nextPath = `${url.pathname}${url.search}`;

          if (
            !hasBootstrappedAuthRef.current &&
            (nextPath.startsWith("/login") || nextPath.startsWith("/register"))
          ) {
            syncAuthIntoWebView();
          }
        }}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        style={styles.webView}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  webView: {
    flex: 1,
  },
});
