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

// Request types
export interface ServiceRequest {
  id: string;
  customerId: string;
  categoryId: string;
  title: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
  preferredDate?: string;
  budgetMin?: number;
  budgetMax?: number;
  images?: string[];
  status: "open" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface CreateRequestData {
  categoryId: string;
  title: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
  preferredDate?: string;
  budgetMin?: number;
  budgetMax?: number;
  images?: string[];
}

export interface UpdateRequestData {
  title?: string;
  description?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  preferredDate?: string;
  budgetMin?: number;
  budgetMax?: number;
  images?: string[];
}

export interface RequestsQuery {
  category?: string;
  city?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Requests API calls
export const requestsApi = {
  create: (data: CreateRequestData, token: string) =>
    apiRequest<ServiceRequest>("/requests", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  getAll: (query?: RequestsQuery) => {
    const params = new URLSearchParams();
    if (query?.category) params.append("category", query.category);
    if (query?.city) params.append("city", query.city);
    if (query?.status) params.append("status", query.status);
    if (query?.page) params.append("page", query.page.toString());
    if (query?.limit) params.append("limit", query.limit.toString());
    const queryString = params.toString();
    return apiRequest<PaginatedResponse<ServiceRequest>>(
      `/requests${queryString ? `?${queryString}` : ""}`
    );
  },

  getMyRequests: (token: string, status?: string) => {
    const params = status ? `?status=${status}` : "";
    return apiRequest<ServiceRequest[]>(`/requests/my${params}`, {
      method: "GET",
      token,
    });
  },

  getById: (id: string) =>
    apiRequest<ServiceRequest>(`/requests/${id}`),

  update: (id: string, data: UpdateRequestData, token: string) =>
    apiRequest<ServiceRequest>(`/requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),

  cancel: (id: string, token: string) =>
    apiRequest<ServiceRequest>(`/requests/${id}`, {
      method: "DELETE",
      token,
    }),
};
