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

// Category API calls
export interface Category {
  id: string;
  slug: string;
  nameDe: string;
  nameEn: string;
  icon: string;
}

export async function getCategories(): Promise<Category[]> {
  return apiRequest<Category[]>("/categories");
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

export interface DashboardStats {
  newRequests: number;
  activeOrders: number;
  completed: number;
  rating: number;
}

export interface RequestItem {
  id: string;
  title: string;
  category: string;
  location: string;
  date: string;
  budget: string;
}

export interface BookingItem {
  id: string;
  customer: string;
  service: string;
  date: string;
  time: string;
  status: string;
}

export interface DashboardData {
  stats: DashboardStats;
  recentRequests: RequestItem[];
  activeBookings: BookingItem[];
}

// Provider Requests types
export interface ProviderRequest {
  id: string;
  title: string;
  category: string;
  categoryName: string;
  description: string;
  location: string;
  address: string;
  preferredDate?: string;
  budget: string | null;
  budgetMin?: number;
  budgetMax?: number;
  createdAt: string;
  customer: {
    name: string;
    memberSince: string;
  };
}

export interface ProviderRequestsResponse {
  data: ProviderRequest[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Provider Bookings types (for calendar)
export interface ProviderBooking {
  id: string;
  title: string;
  customer: string;
  date: string;
  time: string;
  scheduledDate: string;
  status: string;
  address: string;
  totalPrice: number;
  paymentStatus: string;
}

// Provider Reviews types
export interface ProviderReview {
  id: string;
  customer: string;
  rating: number;
  date: string;
  service: string;
  comment: string | null;
  reply: string | null;
}

export interface ProviderReviewsResponse {
  data: ProviderReview[];
  stats: {
    average: number;
    total: number;
    breakdown: Record<number, number>;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Provider Profile types
export interface ProviderProfile {
  id: string;
  userId: string;
  companyName: string | null;
  description: string;
  experienceYears: number;
  serviceAreaRadius: number;
  serviceAreaLat: number;
  serviceAreaLng: number;
  ratingAvg: number;
  totalReviews: number;
  isApproved: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    profileImage: string | null;
  };
  services: {
    id: string;
    categoryId: string;
    title: string;
    description: string;
    priceType: string;
    priceMin: number | null;
    priceMax: number | null;
    category: {
      id: string;
      slug: string;
      nameDe: string;
      nameEn: string;
    };
  }[];
}

export const providerApi = {
  getDashboard: (token: string) =>
    apiRequest<DashboardData>("/providers/me/dashboard", { token }),

  getProfile: (token: string) =>
    apiRequest<ProviderProfile>("/providers/me", { token }),

  getRequests: (token: string, query?: { category?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.category) params.append("category", query.category);
    if (query?.page) params.append("page", query.page.toString());
    if (query?.limit) params.append("limit", query.limit.toString());
    const queryString = params.toString();
    return apiRequest<ProviderRequestsResponse>(
      `/providers/me/requests${queryString ? `?${queryString}` : ""}`,
      { token }
    );
  },

  getBookings: (token: string, query?: { month?: number; year?: number; status?: string }) => {
    const params = new URLSearchParams();
    if (query?.month) params.append("month", query.month.toString());
    if (query?.year) params.append("year", query.year.toString());
    if (query?.status) params.append("status", query.status);
    const queryString = params.toString();
    return apiRequest<ProviderBooking[]>(
      `/providers/me/bookings${queryString ? `?${queryString}` : ""}`,
      { token }
    );
  },

  getReviews: (token: string, query?: { page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.page) params.append("page", query.page.toString());
    if (query?.limit) params.append("limit", query.limit.toString());
    const queryString = params.toString();
    return apiRequest<ProviderReviewsResponse>(
      `/providers/me/reviews${queryString ? `?${queryString}` : ""}`,
      { token }
    );
  },

  replyToReview: (token: string, reviewId: string, reply: string) =>
    apiRequest(`/providers/me/reviews/${reviewId}/reply`, {
      method: "POST",
      body: JSON.stringify({ reply }),
      token,
    }),
};

