"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  authApi,
  isApiUnavailableError,
  type User,
  type LoginData,
  type RegisterData,
} from "@/lib/api";
import { emitAuthStateMessage, WEB_AUTH_SYNC_EVENT } from "@/lib/native-bridge";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = "armut_access_token";
const REFRESH_TOKEN_KEY = "armut_refresh_token";
const USER_KEY = "armut_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isRunningInNativeWebView = () => {
    if (typeof window === "undefined") return false;
    return typeof window.ReactNativeWebView?.postMessage === "function";
  };

  // Get stored tokens
  const getAccessToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  };

  const getRefreshToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  };

  const getStoredUser = () => {
    if (typeof window === "undefined") return null;

    const value = localStorage.getItem(USER_KEY);
    if (!value) return null;

    try {
      return JSON.parse(value) as User;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  };

  const waitForNativeAuthSync = useCallback(async (timeoutMs = 800) => {
    if (!isRunningInNativeWebView()) {
      return;
    }

    if (getStoredUser() && getAccessToken() && getRefreshToken()) {
      return;
    }

    await new Promise<void>((resolve) => {
      const handleSync = () => {
        window.removeEventListener(WEB_AUTH_SYNC_EVENT, handleSync);
        window.clearTimeout(timeoutId);
        resolve();
      };

      const timeoutId = window.setTimeout(handleSync, timeoutMs);
      window.addEventListener(WEB_AUTH_SYNC_EVENT, handleSync, { once: true });
    });
  }, []);

  const emitCurrentAuthState = useCallback((userData: User | null) => {
    if (typeof window === "undefined") return;

    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (accessToken && refreshToken && userData) {
      emitAuthStateMessage({
        isAuthenticated: true,
        accessToken,
        refreshToken,
        user: userData,
      });
      return;
    }

    emitAuthStateMessage({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
    });
  }, []);

  // Store auth data
  const storeAuthData = useCallback(
    (accessToken: string, refreshToken: string, userData: User) => {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setUser(userData);
      emitCurrentAuthState(userData);
    },
    [emitCurrentAuthState],
  );

  // Clear auth data
  const clearAuthData = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    emitCurrentAuthState(null);
  }, [emitCurrentAuthState]);

  // Initialize auth state from storage
  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      let storedUser = getStoredUser();
      let accessToken = getAccessToken();
      let refreshToken = getRefreshToken();

      if (
        (!storedUser || !accessToken || !refreshToken) &&
        isRunningInNativeWebView()
      ) {
        await waitForNativeAuthSync();
        storedUser = getStoredUser();
        accessToken = getAccessToken();
        refreshToken = getRefreshToken();
      }

      if (storedUser && accessToken) {
        setUser(storedUser);

        // Try to verify the token by fetching user data
        try {
          const userData = await authApi.getMe(accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
          setUser(userData);
          emitCurrentAuthState(userData);
        } catch (error) {
          if (isApiUnavailableError(error)) {
            return;
          }

          // Token might be expired, try to refresh
          if (refreshToken) {
            try {
              const response = await authApi.refreshToken(refreshToken);
              storeAuthData(
                response.accessToken,
                response.refreshToken,
                response.user,
              );
            } catch (refreshError) {
              if (isApiUnavailableError(refreshError)) {
                return;
              }

              // Refresh token also expired, clear everything
              clearAuthData();
            }
          } else {
            clearAuthData();
          }
        }
      } else if (storedUser || accessToken || refreshToken) {
        clearAuthData();
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      clearAuthData();
    } finally {
      setIsLoading(false);
    }
  }, [
    clearAuthData,
    emitCurrentAuthState,
    storeAuthData,
    waitForNativeAuthSync,
  ]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleNativeAuthSync = () => {
      void initializeAuth();
    };

    window.addEventListener(WEB_AUTH_SYNC_EVENT, handleNativeAuthSync);
    return () => {
      window.removeEventListener(WEB_AUTH_SYNC_EVENT, handleNativeAuthSync);
    };
  }, [initializeAuth]);

  // Login
  const login = async (data: LoginData) => {
    const response = await authApi.login(data);
    storeAuthData(response.accessToken, response.refreshToken, response.user);
  };

  // Register
  const register = async (data: RegisterData) => {
    const response = await authApi.register(data);
    storeAuthData(response.accessToken, response.refreshToken, response.user);
  };

  // Logout
  const logout = async () => {
    const accessToken = getAccessToken();
    if (accessToken) {
      try {
        await authApi.logout(accessToken);
      } catch {
        // Ignore logout errors
      }
    }
    clearAuthData();
  };

  // Refresh auth
  const refreshAuth = async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const response = await authApi.refreshToken(refreshToken);
      storeAuthData(response.accessToken, response.refreshToken, response.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Hook to get access token for API calls
export function useAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}
