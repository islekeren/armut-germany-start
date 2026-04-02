const DEFAULT_API_ORIGIN = "http://localhost:4000";
const API_UNAVAILABLE_MESSAGE =
  "The service is temporarily unavailable. Please try again shortly.";
const ACCESS_TOKEN_KEY = "armut_access_token";
const REFRESH_TOKEN_KEY = "armut_refresh_token";
const USER_KEY = "armut_user";
const DEFAULT_SERVER_API_TIMEOUT_MS =
  process.env.NODE_ENV === "development" ? 1500 : 5000;
const DEFAULT_CLIENT_API_TIMEOUT_MS =
  process.env.NODE_ENV === "development" ? 1500 : 8000;

interface ApiOptions extends RequestInit {
  token?: string;
  direct?: boolean;
}

type ApiErrorCode = "http" | "unavailable";

export class ApiError extends Error {
  status?: number;
  code: ApiErrorCode;

  constructor(message: string, options: { status?: number; code: ApiErrorCode }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

export function isApiUnavailableError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === "unavailable";
}

export function isApiNotFoundError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404;
}

async function getErrorMessage(response: Response) {
  const contentType = response.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response
      .json()
      .catch(() => null as { message?: unknown } | null);

    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  }

  const text = await response.text().catch(() => "");
  if (text && !text.includes("<html")) {
    return text;
  }

  return `API Error: ${response.status}`;
}

function getApiBaseUrl(direct = false) {
  if (typeof window === "undefined") {
    return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_ORIGIN;
  }

  if (direct) {
    return process.env.NEXT_PUBLIC_API_URL || "";
  }

  return "";
}

function getApiTimeoutMs() {
  const rawValue =
    typeof window === "undefined"
      ? process.env.API_TIMEOUT_MS || process.env.NEXT_PUBLIC_API_TIMEOUT_MS
      : process.env.NEXT_PUBLIC_API_TIMEOUT_MS;

  const parsedValue = Number(rawValue);
  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return typeof window === "undefined"
    ? DEFAULT_SERVER_API_TIMEOUT_MS
    : DEFAULT_CLIENT_API_TIMEOUT_MS;
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const { token, direct, cache, signal, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || undefined);
  const timeoutMs = getApiTimeoutMs();
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(signal?.reason);
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("API request timed out", "TimeoutError")),
    timeoutMs,
  );

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Let the browser set multipart boundary for FormData automatically.
  if (
    fetchOptions.body &&
    !(fetchOptions.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  // The NestJS API has a global prefix of /api
  const url = `${getApiBaseUrl(direct)}/api${endpoint}`;

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      cache: cache ?? (typeof window === "undefined" ? "no-store" : undefined),
      headers,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(API_UNAVAILABLE_MESSAGE, { code: "unavailable" });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  // On client-side, try refreshing once when access token is expired.
  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    !endpoint.startsWith("/auth/")
  ) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${getApiBaseUrl(direct)}/api/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshed = (await refreshResponse.json()) as LoginResponse;

          localStorage.setItem(ACCESS_TOKEN_KEY, refreshed.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshed.refreshToken);
          localStorage.setItem(USER_KEY, JSON.stringify(refreshed.user));

          const retryHeaders = new Headers(fetchOptions.headers || undefined);
          retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`);
          if (
            fetchOptions.body &&
            !(fetchOptions.body instanceof FormData) &&
            !retryHeaders.has("Content-Type")
          ) {
            retryHeaders.set("Content-Type", "application/json");
          }

          response = await fetch(url, {
            ...fetchOptions,
            cache: cache ?? undefined,
            headers: retryHeaders,
          });
        } else {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      } catch {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
  }

  // On client-side, try refreshing once when access token is expired.
  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    !endpoint.startsWith("/auth/")
  ) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${getApiBaseUrl(direct)}/api/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const refreshed = (await refreshResponse.json()) as LoginResponse;

          localStorage.setItem(ACCESS_TOKEN_KEY, refreshed.accessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshed.refreshToken);
          localStorage.setItem(USER_KEY, JSON.stringify(refreshed.user));

          const retryHeaders = new Headers(fetchOptions.headers || undefined);
          retryHeaders.set("Authorization", `Bearer ${refreshed.accessToken}`);
          if (
            fetchOptions.body &&
            !(fetchOptions.body instanceof FormData) &&
            !retryHeaders.has("Content-Type")
          ) {
            retryHeaders.set("Content-Type", "application/json");
          }

          response = await fetch(url, {
            ...fetchOptions,
            cache: cache ?? undefined,
            headers: retryHeaders,
          });
        } else {
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      } catch {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new ApiError(API_UNAVAILABLE_MESSAGE, {
        status: response.status,
        code: "unavailable",
      });
    }

    const message = await getErrorMessage(response);
    throw new ApiError(message, { status: response.status, code: "http" });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text as T;
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("armut_access_token");
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

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  return apiRequest<Category | null>(`/categories/${slug}`);
}

export interface ProviderService {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  priceType: "fixed" | "hourly" | "quote";
  priceMin: number | null;
  priceMax: number | null;
  category: {
    id: string;
    slug: string;
    nameDe: string;
    nameEn: string;
    icon: string;
  };
}

export interface PublicProvider {
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
    firstName: string;
    lastName: string;
    profileImage: string | null;
  };
  profile?: {
    slug: string;
    headline: string | null;
    city: string | null;
  };
  services: ProviderService[];
}

export interface ProviderOpeningHour {
  day: string;
  closed: boolean;
  open?: string | null;
  close?: string | null;
}

export interface PublicProviderReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  providerReply: string | null;
  createdAt: string;
  reviewer: {
    name: string;
    profileImage: string | null;
  };
  service: {
    title: string;
    category: Category;
  };
}

export interface PublicProviderProfile {
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
  completedJobs: number;
  acceptanceRate: number;
  memberSince: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    profileImage: string | null;
  };
  profile: {
    slug: string | null;
    headline: string | null;
    bio: string;
    addressLine1: string | null;
    city: string | null;
    postalCode: string | null;
    website: string | null;
    coverImage: string | null;
    phoneVisible: boolean;
    galleryImages: string[];
    highlights: string[];
    languages: string[];
    openingHours: ProviderOpeningHour[];
  };
  services: ProviderService[];
  reviews: {
    breakdown: Record<number, number>;
    items: PublicProviderReviewItem[];
  };
}

export interface ProvidersResponse {
  data: PublicProvider[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const providersApi = {
  getAll: (query?: {
    categoryId?: string;
    minRating?: number;
    page?: number;
    limit?: number;
    lat?: number;
    lng?: number;
    radius?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.categoryId) params.append("categoryId", query.categoryId);
    if (query?.minRating !== undefined)
      params.append("minRating", query.minRating.toString());
    if (query?.page) params.append("page", query.page.toString());
    if (query?.limit) params.append("limit", query.limit.toString());
    if (query?.lat !== undefined) params.append("lat", query.lat.toString());
    if (query?.lng !== undefined) params.append("lng", query.lng.toString());
    if (query?.radius !== undefined)
      params.append("radius", query.radius.toString());
    const queryString = params.toString();
    return apiRequest<ProvidersResponse>(
      `/providers${queryString ? `?${queryString}` : ""}`,
    );
  },

  getProfile: (providerId: string) =>
    apiRequest<PublicProviderProfile>(`/providers/${providerId}/profile`),
};

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

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
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

  changePassword: (token: string, data: ChangePasswordData) =>
    apiRequest<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),
};

export interface UserProfile {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  userType: "customer" | "provider";
  profileImage?: string | null;
  isVerified?: boolean;
  gdprConsent?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface UpdateUserProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profileImage?: string;
}

export const usersApi = {
  getProfile: (token: string) =>
    apiRequest<UserProfile>("/users/profile", {
      method: "GET",
      token,
    }),

  updateProfile: (token: string, data: UpdateUserProfileData) =>
    apiRequest<UserProfile>("/users/profile", {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),

  deleteProfile: (token: string) =>
    apiRequest<UserProfile>("/users/profile", {
      method: "DELETE",
      token,
    }),
};

// Request types
export interface ServiceRequest {
  id: string;
  customerId: string;
  categoryId: string;
  requestSector?: string | null;
  requestBranch?: string | null;
  category?: Category;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string | null;
    createdAt?: string;
  };
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
  _count?: {
    quotes: number;
  };
  quotes?: unknown[];
}

export interface CreateRequestData {
  categoryId: string;
  requestSector?: string;
  requestBranch?: string;
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
  requestSector?: string;
  requestBranch?: string;
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
      `/requests${queryString ? `?${queryString}` : ""}`,
    );
  },

  getMyRequests: (token: string, status?: string) => {
    const params = status ? `?status=${status}` : "";
    return apiRequest<ServiceRequest[]>(`/requests/my${params}`, {
      method: "GET",
      token,
      cache: "no-store",
    });
  },

  getById: (id: string) => apiRequest<ServiceRequest>(`/requests/${id}`),

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
  requestSector?: string | null;
  requestSectorNameEn?: string | null;
  requestSectorNameDe?: string | null;
  requestBranch?: string | null;
  requestBranchNameEn?: string | null;
  requestBranchNameDe?: string | null;
  offerId?: string | null;
  offerStatus?: QuoteStatus | null;
  offeredAt?: string | null;
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
  job?: {
    bookingId: string;
    requestId: string;
    title: string;
  };
  customerComment?: string | null;
  comment: string | null;
  reply: string | null;
  images?: string[];
  replyImages?: string[];
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
  profile?: {
    id: string;
    providerId: string;
    slug: string;
    headline: string | null;
    bio: string | null;
    addressLine1: string | null;
    city: string | null;
    postalCode: string | null;
    website: string | null;
    coverImage: string | null;
    phoneVisible: boolean;
    galleryImages: string[];
    highlights: string[];
    languages: string[];
    openingHours: ProviderOpeningHour[] | null;
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

export interface CreateProviderProfileData {
  companyName?: string;
  description: string;
  experienceYears?: number;
  serviceAreaRadius: number;
  serviceAreaLat: number;
  serviceAreaLng: number;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  website?: string;
  categories?: string[];
  priceMin?: number;
  priceMax?: number;
}

export interface UpdateProviderProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  description?: string;
  experienceYears?: number;
  serviceAreaRadius?: number;
  serviceAreaLat?: number;
  serviceAreaLng?: number;
  priceMin?: number;
  priceMax?: number;
  headline?: string;
  bio?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  website?: string;
  coverImage?: string;
  phoneVisible?: boolean;
  galleryImages?: string[];
  highlights?: string[];
  languages?: string[];
  openingHours?: ProviderOpeningHour[];
}

export const providerApi = {
  createProfile: (token: string, data: CreateProviderProfileData) =>
    apiRequest<ProviderProfile>("/providers", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  getDashboard: (token: string) =>
    apiRequest<DashboardData>("/providers/me/dashboard", { token }),

  getProfile: (token: string) =>
    apiRequest<ProviderProfile>("/providers/me", { token }),

  updateProfile: (token: string, data: UpdateProviderProfileData) =>
    apiRequest<ProviderProfile>("/providers/me/profile", {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),

  getRequests: (
    token: string,
    query?: { category?: string; page?: number; limit?: number },
  ) => {
    const params = new URLSearchParams();
    if (query?.category) params.append("category", query.category);
    if (query?.page) params.append("page", query.page.toString());
    if (query?.limit) params.append("limit", query.limit.toString());
    const queryString = params.toString();
    return apiRequest<ProviderRequestsResponse>(
      `/providers/me/requests${queryString ? `?${queryString}` : ""}`,
      { token },
    );
  },

  getBookings: (
    token: string,
    query?: { month?: number; year?: number; status?: string },
  ) => {
    const params = new URLSearchParams();
    if (query?.month) params.append("month", query.month.toString());
    if (query?.year) params.append("year", query.year.toString());
    if (query?.status) params.append("status", query.status);
    const queryString = params.toString();
    return apiRequest<ProviderBooking[]>(
      `/providers/me/bookings${queryString ? `?${queryString}` : ""}`,
      { token, cache: "no-store" },
    );
  },

  getReviews: (token: string, query?: { page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.page) params.append("page", query.page.toString());
    if (query?.limit) params.append("limit", query.limit.toString());
    const queryString = params.toString();
    return apiRequest<ProviderReviewsResponse>(
      `/providers/me/reviews${queryString ? `?${queryString}` : ""}`,
      { token },
    );
  },

  replyToReview: (
    token: string,
    reviewId: string,
    data: { reply: string; replyImages?: string[] },
  ) =>
    apiRequest(`/providers/me/reviews/${reviewId}/reply`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),
};

export type QuoteStatus = "pending" | "accepted" | "rejected" | "expired";

export interface Quote {
  id: string;
  requestId: string;
  providerId: string;
  customerId: string;
  price: number;
  message: string;
  validUntil: string;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
  provider?: {
    id: string;
    companyName?: string | null;
    ratingAvg?: number;
    totalReviews?: number;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      profileImage?: string | null;
      phone?: string | null;
    };
  };
  request?: {
    id: string;
    title?: string;
    description?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    preferredDate?: string | null;
    category?: Category;
    customer?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
}

export interface CreateQuoteData {
  requestId: string;
  price: number;
  message: string;
  validUntil: string;
}

export interface UpdateQuoteData {
  price?: number;
  message?: string;
  validUntil?: string;
}

export const quotesApi = {
  create: (token: string, data: CreateQuoteData) =>
    apiRequest<Quote>("/quotes", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  getByRequest: (token: string, requestId: string) =>
    apiRequest<Quote[]>(`/quotes/request/${requestId}`, { token }),

  // Provider's own sent quotes
  getMyQuotes: (token: string) =>
    apiRequest<Quote[]>("/quotes/my-quotes", { token }),

  // Customer's received quotes for their requests
  getReceivedQuotes: (token: string) =>
    apiRequest<Quote[]>("/quotes/received", { token, cache: "no-store" }),

  getById: (token: string, id: string) =>
    apiRequest<Quote>(`/quotes/${id}`, { token }),

  update: (token: string, id: string, data: UpdateQuoteData) =>
    apiRequest<Quote>(`/quotes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      token,
    }),

  respond: (token: string, id: string, action: "accepted" | "rejected") =>
    apiRequest<Quote>(`/quotes/${id}/respond`, {
      method: "POST",
      body: JSON.stringify({ action }),
      token,
    }),

  withdraw: (token: string, id: string) =>
    apiRequest(`/quotes/${id}`, {
      method: "DELETE",
      token,
    }),
};

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completion_pending"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "refunded" | "failed";

export interface BookingReview {
  id: string;
  rating: number;
  comment?: string | null;
  images?: string[];
  providerReply?: string | null;
  providerReplyImages?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface BookingPayment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingProvider {
  id: string;
  companyName?: string | null;
  ratingAvg?: number;
  totalReviews?: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    profileImage?: string | null;
  };
}

export interface BookingCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  profileImage?: string | null;
}

export interface BookingRequest {
  id: string;
  title: string;
  description?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  preferredDate?: string | null;
  category?: Category;
}

export interface CustomerBooking {
  id: string;
  quoteId: string;
  customerId: string;
  providerId: string;
  scheduledDate: string;
  status: BookingStatus;
  totalPrice: number;
  paymentStatus: PaymentStatus;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  quote?: Quote & {
    request?: BookingRequest;
  };
  provider?: BookingProvider;
  customer?: BookingCustomer;
  review?: BookingReview | null;
  payment?: BookingPayment | null;
}

export interface BookingListResponse {
  data: CustomerBooking[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BookingsQuery {
  status?: BookingStatus;
  page?: number;
  limit?: number;
}

export interface CreateBookingData {
  quoteId: string;
  scheduledDate: string;
}

export interface CreateReviewData {
  rating: number;
  comment?: string;
  images?: string[];
}

export const bookingsApi = {
  create: (token: string, data: CreateBookingData) =>
    apiRequest<CustomerBooking>("/bookings", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  getCustomerBookings: (token: string, query?: BookingsQuery) => {
    const params = new URLSearchParams();
    if (query?.status) params.append("status", query.status);
    if (query?.page) params.append("page", query.page.toString());
    if (query?.limit) params.append("limit", query.limit.toString());
    const queryString = params.toString();

    return apiRequest<BookingListResponse>(
      `/bookings/customer${queryString ? `?${queryString}` : ""}`,
      { token },
    );
  },

  getUpcomingCustomer: (token: string) =>
    apiRequest<CustomerBooking[]>("/bookings/upcoming/customer", { token }),

  getById: (token: string, id: string) =>
    apiRequest<CustomerBooking>(`/bookings/${id}`, { token }),

  updateStatus: (token: string, id: string, status: BookingStatus) =>
    apiRequest<CustomerBooking>(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      token,
    }),

  reschedule: (token: string, id: string, scheduledDate: string) =>
    apiRequest<CustomerBooking>(`/bookings/${id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({ scheduledDate }),
      token,
    }),

  createReview: (token: string, id: string, data: CreateReviewData) =>
    apiRequest<BookingReview>(`/bookings/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),
};

export interface ConversationParticipant {
  id: string;
  userId: string;
  conversationId?: string;
  joinedAt?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string | null;
  };
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments: string[];
  readAt?: string | null;
  createdAt: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string | null;
  };
}

export interface ConversationItem {
  id: string;
  requestId?: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  participants: ConversationParticipant[];
  messages?: MessageItem[];
  unreadCount?: number;
  otherParticipant?: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage?: string | null;
  };
  request?: {
    id: string;
    title?: string;
    category?: Category;
  };
}

export interface MessagesPageResponse {
  data: MessageItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const messagesApi = {
  createConversation: (
    token: string,
    data: { participantId: string; requestId?: string },
  ) =>
    apiRequest<ConversationItem>("/messages/conversations", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  getConversations: (token: string) =>
    apiRequest<ConversationItem[]>("/messages/conversations", { token }),

  getConversation: (token: string, conversationId: string) =>
    apiRequest<ConversationItem>(`/messages/conversations/${conversationId}`, {
      token,
    }),

  getMessages: (token: string, conversationId: string, page = 1, limit = 50) =>
    apiRequest<MessagesPageResponse>(
      `/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
      { token },
    ),

  sendMessage: (
    token: string,
    data: { conversationId: string; content: string; attachments?: string[] },
  ) =>
    apiRequest<MessageItem>("/messages/send", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  markAsRead: (token: string, conversationId: string) =>
    apiRequest<{ success: boolean }>("/messages/read", {
      method: "POST",
      body: JSON.stringify({ conversationId }),
      token,
    }),

  getUnreadCount: (token: string) =>
    apiRequest<{ unreadCount: number }>("/messages/unread-count", { token }),
};

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export const notificationsApi = {
  getAll: (token: string, query?: { onlyUnread?: boolean; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.onlyUnread !== undefined) {
      params.append("onlyUnread", String(query.onlyUnread));
    }
    if (query?.limit) {
      params.append("limit", String(query.limit));
    }

    const queryString = params.toString();
    return apiRequest<NotificationItem[]>(
      `/notifications${queryString ? `?${queryString}` : ""}`,
      { token },
    );
  },

  getUnreadCount: (token: string) =>
    apiRequest<{ unreadCount: number }>("/notifications/unread-count", { token }),

  markAsRead: (token: string, id: string) =>
    apiRequest<NotificationItem>(`/notifications/${id}/read`, {
      method: "POST",
      token,
    }),

  markAllAsRead: (token: string) =>
    apiRequest<{ updated: number }>("/notifications/read-all", {
      method: "POST",
      token,
    }),
};

export type UploadFolder =
  | "profiles"
  | "portfolios"
  | "documents"
  | "requests"
  | "messages";

export interface UploadResult {
  key: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
}

function buildFilesFormData(files: File[], fieldName = "files") {
  const formData = new FormData();
  files.forEach((file) => formData.append(fieldName, file));
  return formData;
}

export const uploadsApi = {
  uploadProfileImage: (token: string, file: File) => {
    const formData = buildFilesFormData([file], "file");
    return apiRequest<UploadResult>("/uploads/profile", {
      method: "POST",
      body: formData,
      token,
    });
  },

  uploadRequestImages: (token: string, files: File[]) =>
    apiRequest<UploadResult[]>("/uploads/request", {
      method: "POST",
      body: buildFilesFormData(files),
      token,
    }),

  uploadMessageAttachments: (token: string, files: File[]) =>
    apiRequest<UploadResult[]>("/uploads/message", {
      method: "POST",
      body: buildFilesFormData(files),
      token,
    }),

  getPresignedUploadUrl: (
    token: string,
    data: { folder: UploadFolder; filename: string; contentType: string },
  ) =>
    apiRequest<{ uploadUrl: string; key: string; publicUrl: string }>(
      "/uploads/presigned",
      {
        method: "POST",
        body: JSON.stringify(data),
        token,
      },
    ),

  deleteFile: (token: string, key: string) =>
    apiRequest<{ success: boolean }>(`/uploads/${encodeURIComponent(key)}`, {
      method: "DELETE",
      token,
    }),
};
