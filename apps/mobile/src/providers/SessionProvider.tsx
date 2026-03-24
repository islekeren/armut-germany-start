import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  authApi,
  type LoginData,
  type LoginResponse,
  type RegisterData,
  type User,
} from "../lib/api";

const ACCESS_TOKEN_KEY = "armut_mobile_access_token";
const REFRESH_TOKEN_KEY = "armut_mobile_refresh_token";
const USER_KEY = "armut_mobile_user";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

type SessionContextValue = {
  session: StoredSession | null;
  isLoading: boolean;
  signIn: (data: LoginData) => Promise<StoredSession>;
  registerAccount: (data: RegisterData) => Promise<StoredSession>;
  signOut: (options?: { remote?: boolean }) => Promise<void>;
  syncSessionFromWeb: (session: StoredSession | null) => Promise<void>;
};

export type WebBridgeMessage =
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

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function buildStoredSession(response: LoginResponse): StoredSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: response.user,
  };
}

async function saveSession(session: StoredSession) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user)),
  ]);
}

async function clearSessionStorage() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

async function loadSession() {
  const [accessToken, refreshToken, serializedUser] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);

  if (!accessToken || !refreshToken || !serializedUser) {
    return null;
  }

  try {
    const user = JSON.parse(serializedUser) as User;

    return {
      accessToken,
      refreshToken,
      user,
    } satisfies StoredSession;
  } catch {
    await clearSessionStorage();
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function persistSession(nextSession: StoredSession | null) {
    if (!nextSession) {
      await clearSessionStorage();
      setSession(null);
      return;
    }

    await saveSession(nextSession);
    setSession(nextSession);
  }

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const storedSession = await loadSession();

        if (!storedSession) {
          if (isMounted) {
            setSession(null);
          }
          return;
        }

        try {
          const user = await authApi.getMe(storedSession.accessToken);
          if (isMounted) {
            await persistSession({ ...storedSession, user });
          }
          return;
        } catch {
          const refreshed = await authApi.refreshToken(storedSession.refreshToken);
          if (isMounted) {
            await persistSession(buildStoredSession(refreshed));
          }
        }
      } catch {
        if (isMounted) {
          await persistSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function signIn(data: LoginData) {
    const response = await authApi.login(data);
    const nextSession = buildStoredSession(response);
    await persistSession(nextSession);
    return nextSession;
  }

  async function registerAccount(data: RegisterData) {
    const response = await authApi.register(data);
    const nextSession = buildStoredSession(response);
    await persistSession(nextSession);
    return nextSession;
  }

  async function signOut(options: { remote?: boolean } = {}) {
    const shouldLogoutRemotely = options.remote ?? true;

    if (shouldLogoutRemotely && session?.accessToken) {
      try {
        await authApi.logout(session.accessToken);
      } catch {
        // Ignore logout failures and still clear the local session.
      }
    }

    await persistSession(null);
  }

  async function syncSessionFromWeb(nextSession: StoredSession | null) {
    await persistSession(nextSession);
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        isLoading,
        signIn,
        registerAccount,
        signOut,
        syncSessionFromWeb,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}
