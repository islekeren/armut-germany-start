const DEFAULT_API_URL = "http://localhost:4000";
const API_UNAVAILABLE_MESSAGE =
  "The service is temporarily unavailable. Please try again shortly.";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

interface ApiRequestOptions extends RequestInit {
  token?: string;
}

type ApiErrorCode = "http" | "unavailable";

export class ApiError extends Error {
  status?: number;
  code: ApiErrorCode;

  constructor(message: string, options: { code: ApiErrorCode; status?: number }) {
    super(message);
    this.name = "ApiError";
    this.code = options.code;
    this.status = options.status;
  }
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
  phone?: string;
  userType: "customer" | "provider";
  gdprConsent: boolean;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

async function getErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response
      .json()
      .catch(() => null as { message?: unknown } | null);

    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  }

  const text = await response.text().catch(() => "");
  return text || `API Error: ${response.status}`;
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { token, ...requestInit } = options;
  const headers = new Headers(requestInit.headers || undefined);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    requestInit.body &&
    !(requestInit.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...requestInit,
      headers,
    });
  } catch {
    throw new ApiError(API_UNAVAILABLE_MESSAGE, { code: "unavailable" });
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new ApiError(API_UNAVAILABLE_MESSAGE, {
        code: "unavailable",
        status: response.status,
      });
    }

    const message = await getErrorMessage(response);
    throw new ApiError(message, { code: "http", status: response.status });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as T;
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
