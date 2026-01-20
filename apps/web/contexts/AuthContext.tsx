"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authApi, type User, type LoginData, type RegisterData } from "@/lib/api";

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

  // Get stored tokens
  const getAccessToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  };

  const getRefreshToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
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
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  // Initialize auth state from storage
  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedUser = localStorage.getItem(USER_KEY);
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();

      if (storedUser && accessToken) {
        // Try to verify the token by fetching user data
        try {
          const userData = await authApi.getMe(accessToken);
          setUser(userData);
        } catch {
          // Token might be expired, try to refresh
          if (refreshToken) {
            try {
              const response = await authApi.refreshToken(refreshToken);
              storeAuthData(response.accessToken, response.refreshToken, response.user);
            } catch {
              // Refresh token also expired, clear everything
              clearAuthData();
            }
          } else {
            clearAuthData();
          }
        }
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
