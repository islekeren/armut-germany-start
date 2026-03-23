import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, isApiUnavailableError, type LoginData, type RegisterData, type User } from "@/lib/api";
import { getItem, getJsonItem, removeItem, setItem, setJsonItem } from "@/lib/storage";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
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

async function storeAuthState(
  accessToken: string,
  refreshToken: string,
  user: User,
  setUser: (value: User | null) => void,
  setAccessToken: (value: string | null) => void,
  setRefreshToken: (value: string | null) => void,
) {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, accessToken),
    setItem(REFRESH_TOKEN_KEY, refreshToken),
    setJsonItem(USER_KEY, user),
  ]);

  setUser(user);
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);
}

async function clearAuthState(
  setUser: (value: User | null) => void,
  setAccessToken: (value: string | null) => void,
  setRefreshToken: (value: string | null) => void,
) {
  await Promise.all([
    removeItem(ACCESS_TOKEN_KEY),
    removeItem(REFRESH_TOKEN_KEY),
    removeItem(USER_KEY),
  ]);

  setUser(null);
  setAccessToken(null);
  setRefreshToken(null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      setIsLoading(true);

      try {
        const [storedUser, storedAccessToken, storedRefreshToken] = await Promise.all([
          getJsonItem<User>(USER_KEY),
          getItem(ACCESS_TOKEN_KEY),
          getItem(REFRESH_TOKEN_KEY),
        ]);

        if (!isMounted) return;

        if (storedUser && storedAccessToken) {
          setUser(storedUser);
          setAccessToken(storedAccessToken);
          setRefreshToken(storedRefreshToken);

          try {
            const me = await authApi.getMe(storedAccessToken);
            if (!isMounted) return;

            await setJsonItem(USER_KEY, me);
            setUser(me);
          } catch (error) {
            if (isApiUnavailableError(error)) {
              return;
            }

            if (storedRefreshToken) {
              try {
                const refreshed = await authApi.refreshToken(storedRefreshToken);
                if (!isMounted) return;

                await storeAuthState(
                  refreshed.accessToken,
                  refreshed.refreshToken,
                  refreshed.user,
                  setUser,
                  setAccessToken,
                  setRefreshToken,
                );
              } catch (refreshError) {
                if (isApiUnavailableError(refreshError)) {
                  return;
                }

                await clearAuthState(setUser, setAccessToken, setRefreshToken);
              }
            } else {
              await clearAuthState(setUser, setAccessToken, setRefreshToken);
            }
          }
        } else if (storedUser || storedAccessToken || storedRefreshToken) {
          await clearAuthState(setUser, setAccessToken, setRefreshToken);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        await clearAuthState(setUser, setAccessToken, setRefreshToken);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(data: LoginData) {
    const response = await authApi.login(data);
    await storeAuthState(
      response.accessToken,
      response.refreshToken,
      response.user,
      setUser,
      setAccessToken,
      setRefreshToken,
    );
  }

  async function register(data: RegisterData) {
    const response = await authApi.register(data);
    await storeAuthState(
      response.accessToken,
      response.refreshToken,
      response.user,
      setUser,
      setAccessToken,
      setRefreshToken,
    );
  }

  async function logout() {
    if (accessToken) {
      try {
        await authApi.logout(accessToken);
      } catch {
        // Ignore remote logout failures and clear local state.
      }
    }

    await clearAuthState(setUser, setAccessToken, setRefreshToken);
  }

  async function refreshAuth() {
    if (!refreshToken) return;

    const response = await authApi.refreshToken(refreshToken);
    await storeAuthState(
      response.accessToken,
      response.refreshToken,
      response.user,
      setUser,
      setAccessToken,
      setRefreshToken,
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isLoading,
        isAuthenticated: Boolean(user && accessToken),
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

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

export function useAccessToken() {
  return useAuth().accessToken;
}
