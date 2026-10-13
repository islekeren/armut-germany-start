"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  authApi,
  ApiError,
  type ChangePasswordData,
  isTransientApiError,
  type User,
  type LoginData,
  type RegisterData,
} from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
  changePassword: (data: ChangePasswordData) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = "armut_access_token";
const REFRESH_TOKEN_KEY = "armut_refresh_token";
const USER_KEY = "armut_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionEpoch = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  // Store auth data
  const storeAuthData = (accessToken: string, refreshToken: string, userData: User) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  // Clear auth data
  const clearAuthData = () => {
    sessionEpoch.current += 1;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  // Initialize auth state from storage
  const initializeAuth = useCallback(async () => {
    const epoch = sessionEpoch.current;
    setIsLoading(true);
    try {
      const storedUser = getStoredUser();
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();

      if (storedUser && accessToken) {
        setUser(storedUser);

        // Try to verify the token by fetching user data
        try {
          const userData = await authApi.getMe(accessToken);
          if (epoch !== sessionEpoch.current) return;
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
          setUser(userData);
        } catch (error) {
          if (epoch !== sessionEpoch.current) return;
          if (isTransientApiError(error)) {
            return;
          }

          // Token might be expired, try to refresh
          if (refreshToken) {
            try {
              const response = await authApi.refreshToken(refreshToken);
              if (epoch !== sessionEpoch.current) return;
              storeAuthData(response.accessToken, response.refreshToken, response.user);
            } catch (refreshError) {
              if (epoch !== sessionEpoch.current) return;
              if (isTransientApiError(refreshError)) {
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
  }, []);

  useEffect(() => {
    initializeAuth();
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

  // Successful logout revokes this persisted device session. Keep credentials
  // on network failures so the user can retry instead of silently leaving it live.
  const logout = async () => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    try {
      if (accessToken) {
        try { await authApi.logout(accessToken); }
        catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
          if (refreshToken) {
            const refreshed = await authApi.refreshToken(refreshToken);
            await authApi.logout(refreshed.accessToken);
          }
        }
      } else if (refreshToken) {
        const refreshed = await authApi.refreshToken(refreshToken);
        await authApi.logout(refreshed.accessToken);
      }
    } catch (error) {
      // An already revoked/expired session needs only local cleanup.
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    clearAuthData();
  };

  const changePassword = async (data: ChangePasswordData) => {
    const token = getAccessToken();
    if (!token) throw new ApiError("Authentication required", { status: 401, code: "http" });
    await authApi.changePassword(token, data);
    clearAuthData();
  };

  // Refresh auth
  const refreshAuth = async () => {
    const epoch = sessionEpoch.current;
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const response = await authApi.refreshToken(refreshToken);
      if (epoch !== sessionEpoch.current) return;
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
        clearSession: clearAuthData,
        changePassword,
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
