const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ApiOptions extends RequestInit {
  token?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // The NestJS API has a global prefix of /api
  const url = `${API_URL}/api${endpoint}`;
  
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `API Error: ${response.status}`);
  }

  return response.json();
}

// Auth API calls
export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: "customer" | "provider";
  phone?: string;
  avatar?: string;
  createdAt: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  userType: "customer" | "provider";
  gdprConsent: boolean;
}

export const authApi = {
  login: (data: LoginData) =>
    apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  register: (data: RegisterData) =>
    apiRequest<LoginResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  refreshToken: (refreshToken: string) =>
    apiRequest<LoginResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (token: string) =>
    apiRequest<void>("/auth/logout", {
      method: "POST",
      token,
    }),

  getMe: (token: string) =>
    apiRequest<User>("/auth/me", {
      method: "GET",
      token,
    }),
};
