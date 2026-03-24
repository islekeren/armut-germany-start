"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Header } from "@/components";
import { useAuth } from "@/contexts";
import {
  bookingsApi,
  getStoredAccessToken,
  quotesApi,
  requestsApi,
  type CustomerBooking,
  type Quote,
  type ServiceRequest,
} from "@/lib/api";
import { getProviderDisplayName } from "@/lib/bookings";

type DisplayRequestStatus = "active" | "booked" | "completed" | "cancelled";

interface RequestCard {
  id: string;
  title: string;
  category: string;
  status: DisplayRequestStatus;
  createdAt: string;
  location: string;
  quotes: number;
  description: string;
  bookedProvider?: string;
  bookingId?: string;
  acceptedQuoteId?: string;
  hasReview?: boolean;
  completedAt?: string;
}

// Map API status to display status
const mapApiStatus = (status: string): DisplayRequestStatus => {
  switch (status) {
    case "open":
      return "active";
    case "in_progress":
      return "booked";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "active";
  }
};

// Transform API request to display format
const transformRequest = (
  request: ServiceRequest,
  context: {
    bookingsByRequestId: Map<string, CustomerBooking>;
    acceptedQuotesByRequestId: Map<string, Quote>;
  },
): RequestCard => {
  const booking = context.bookingsByRequestId.get(request.id);
  const acceptedQuote = context.acceptedQuotesByRequestId.get(request.id);

  return {
    id: request.id,
    title: request.title,
    category: request.category?.nameEn || request.category?.slug || request.categoryId,
    status: mapApiStatus(request.status),
    createdAt: new Date(request.createdAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    location: `${request.postalCode} ${request.city}`,
    quotes: request._count?.quotes ?? request.quotes?.length ?? 0,
    description: request.description,
    bookedProvider: booking
      ? getProviderDisplayName(booking.provider)
      : acceptedQuote
        ? getProviderDisplayName(acceptedQuote.provider)
        : undefined,
    bookingId: booking?.id,
    acceptedQuoteId: acceptedQuote?.id,
    hasReview: Boolean(booking?.review),
    completedAt: booking?.completedAt
      ? new Date(booking.completedAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : undefined,
  };
};

export default function MyRequestsPage() {
  const t = useTranslations("customer.requests");
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState("booked");
  const [requests, setRequests] = useState<RequestCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        setError("Please log in to view your requests");
        setIsLoading(false);
        return;
      }

      try {
        const [apiRequests, bookingsResponse, customerQuotes] = await Promise.all([
          requestsApi.getMyRequests(token),
          bookingsApi.getCustomerBookings(token, { page: 1, limit: 100 }),
          quotesApi.getMyQuotes(token),
        ]);

        const bookingsByRequestId = new Map<string, CustomerBooking>();
        bookingsResponse.data.forEach((booking) => {
          const requestId = booking.quote?.request?.id;
          if (requestId) {
            bookingsByRequestId.set(requestId, booking);
          }
        });

        const acceptedQuotesByRequestId = new Map<string, Quote>();
        customerQuotes
          .filter((quote) => quote.status === "accepted" && quote.request?.id)
          .forEach((quote) => {
            if (quote.request?.id) {
              acceptedQuotesByRequestId.set(quote.request.id, quote);
            }
          });

        const transformedRequests = (apiRequests || []).map((request) =>
          transformRequest(request, {
            bookingsByRequestId,
            acceptedQuotesByRequestId,
          }),
        );
        setRequests(transformedRequests);
      } catch (err) {
        console.error("Failed to fetch requests:", err);
        setError(err instanceof Error ? err.message : "Failed to load requests");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [isAuthenticated]);

  const handleDeleteRequest = async (requestId: string) => {
    const confirmed = window.confirm(t("deleteConfirm"));
    if (!confirmed) return;

    const token = getStoredAccessToken();
    if (!token) {
      setError(t("deleteError"));
      return;
    }

    setDeletingRequestId(requestId);
    setError(null);
    setSuccessMessage(null);

    try {
      await requestsApi.cancel(requestId, token);
      setRequests((prev) => prev.filter((req) => req.id !== requestId));
      setSuccessMessage(t("deleteSuccess"));
    } catch (err) {
      console.error("Failed to delete request:", err);
      setError(err instanceof Error ? err.message : t("deleteError"));
    } finally {
      setDeletingRequestId(null);
    }
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    active: { label: t("status.active"), color: "bg-green-100 text-green-700" },
    booked: { label: t("status.booked"), color: "bg-blue-100 text-blue-700" },
    completed: { label: t("status.completed"), color: "bg-gray-100 text-gray-700" },
    cancelled: { label: t("status.cancelled"), color: "bg-red-100 text-red-700" },
  };

  const filteredRequests = requests.filter((r) => r.status === filter);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 text-4xl">⏳</div>
              <p className="text-muted">{t("loading")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
            {error}
          </div>
        </div>
      )}
      {successMessage && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            {successMessage}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted">{t("subtitle")}</p>
          </div>
          <Link
            href="/create-request"
            className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark"
          >
            {t("newRequest")}
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {[
            { id: "active", label: t("filters.active") },
            { id: "booked", label: t("filters.booked") },
            { id: "completed", label: t("filters.completed") },
            { id: "cancelled", label: t("filters.cancelled") },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
                filter === f.id
                  ? "bg-primary text-white"
                  : "bg-white text-muted hover:bg-background"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        statusLabels[request.status]?.color ?? ""
                      }`}
                    >
                      {statusLabels[request.status]?.label ?? request.status}
                    </span>
                    <span className="text-sm text-muted">
                      {request.category}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">{request.title}</h3>
                  <p className="mt-1 text-muted">{request.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted">
                    <span>📍 {request.location}</span>
                    <span>📅 {t("createdOn")} {request.createdAt}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {request.status === "active" && (
                    <>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {request.quotes}
                        </div>
                        <div className="text-sm text-muted">{t("quotes")}</div>
                      </div>
                      <Link
                        href={`/my-requests/${request.id}`}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                      >
                        {t("viewQuotes")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequest(request.id)}
                        disabled={deletingRequestId === request.id}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingRequestId === request.id ? t("deleting") : t("delete")}
                      </button>
                    </>
                  )}
                  {request.status === "booked" && (
                    <>
                      <div className="text-right text-sm">
                        <div className="text-muted">{t("bookedWith")}</div>
                        <div className="font-medium">
                          {request.bookedProvider || t("bookingPending")}
                        </div>
                      </div>
                      <Link
                        href={
                          request.bookingId
                            ? `/bookings/${request.bookingId}`
                            : request.acceptedQuoteId
                              ? `/bookings/new?quote=${request.acceptedQuoteId}`
                              : `/my-requests/${request.id}`
                        }
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
                      >
                        {request.bookingId
                          ? t("manageBooking")
                          : request.acceptedQuoteId
                            ? t("completeBooking")
                            : t("viewDetails")}
                      </Link>
                    </>
                  )}
                  {request.status === "completed" && (
                    <>
                      <div className="text-right text-sm">
                        <div className="text-muted">{t("completedOn")}</div>
                        <div className="font-medium">{request.completedAt}</div>
                      </div>
                      <Link
                        href={request.bookingId ? `/bookings/${request.bookingId}` : `/my-requests/${request.id}`}
                        className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90"
                      >
                        {request.hasReview ? t("viewBooking") : t("rate")}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredRequests.length === 0 && (
          <div className="rounded-xl bg-white py-12 text-center">
            <div className="mb-4 text-5xl">📭</div>
            <h3 className="text-lg font-semibold">{t("noRequests")}</h3>
            <p className="mt-2 text-muted">{t("noRequestsHint")}</p>
            <Link
              href="/create-request"
              className="mt-4 inline-block rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark"
            >
              {t("createRequest")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
