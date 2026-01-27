"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Header } from "@/components";
import { useAuth } from "@/contexts";
import { requestsApi, type ServiceRequest } from "@/lib/api";

const mockRequests = [
  {
    id: "1",
    title: "Apartment cleaning needed (80sqm)",
    category: "Cleaning",
    status: "active",
    createdAt: "January 10, 2026",
    location: "10115 Berlin",
    quotes: 3,
    description: "Thorough cleaning of my 3-room apartment",
  },
  {
    id: "2",
    title: "Moving helpers needed",
    category: "Moving",
    status: "active",
    createdAt: "January 8, 2026",
    location: "10117 Berlin",
    quotes: 5,
    description: "Moving from 2-room apartment to new apartment",
  },
  {
    id: "3",
    title: "Paint bathroom",
    category: "Painter",
    status: "booked",
    createdAt: "January 5, 2026",
    location: "10119 Berlin",
    quotes: 4,
    bookedProvider: "Master Painter Smith",
    description: "Repaint bathroom, approx. 8sqm",
  },
  {
    id: "4",
    title: "Winterize garden",
    category: "Garden",
    status: "completed",
    createdAt: "December 1, 2025",
    location: "10115 Berlin",
    quotes: 2,
    completedAt: "December 15, 2025",
    description: "Trim hedges, remove leaves",
  },
];

// Map API status to display status
const mapApiStatus = (status: string): string => {
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
const transformRequest = (request: ServiceRequest) => ({
  id: request.id,
  title: request.title,
  category: request.categoryId, // Could be mapped to category name if needed
  status: mapApiStatus(request.status),
  createdAt: new Date(request.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }),
  location: `${request.postalCode} ${request.city}`,
  quotes: 0, // Would come from a separate quotes endpoint
  description: request.description,
  bookedProvider: undefined as string | undefined,
  completedAt: undefined as string | undefined,
});

export default function MyRequestsPage() {
  const t = useTranslations("customer.requests");
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState("alle");
  const [requests, setRequests] = useState(mockRequests);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("armut_access_token");
  };

  useEffect(() => {
    const fetchRequests = async () => {
      const token = getAccessToken();
      if (!token) {
        // Use mock data if not authenticated
        setIsLoading(false);
        return;
      }

      try {
        const apiRequests = await requestsApi.getMyRequests(token);
        if (apiRequests && apiRequests.length > 0) {
          const transformedRequests = apiRequests.map(transformRequest);
          // Combine API requests with mock data (API first)
          setRequests([...transformedRequests, ...mockRequests]);
        }
      } catch (err) {
        console.error("Failed to fetch requests:", err);
        setError(err instanceof Error ? err.message : "Failed to load requests");
        // Keep using mock data on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();
  }, [isAuthenticated]);

  const statusLabels: Record<string, { label: string; color: string }> = {
    active: { label: t("status.active"), color: "bg-green-100 text-green-700" },
    booked: { label: t("status.booked"), color: "bg-blue-100 text-blue-700" },
    completed: { label: t("status.completed"), color: "bg-gray-100 text-gray-700" },
    cancelled: { label: t("status.cancelled"), color: "bg-red-100 text-red-700" },
  };

  const filteredRequests =
    filter === "alle"
      ? requests
      : requests.filter((r) => r.status === filter);

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
            { id: "alle", label: t("filters.all") },
            { id: "active", label: t("filters.active") },
            { id: "booked", label: t("filters.booked") },
            { id: "completed", label: t("filters.completed") },
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
                    </>
                  )}
                  {request.status === "booked" && (
                    <>
                      <div className="text-right text-sm">
                        <div className="text-muted">{t("bookedWith")}</div>
                        <div className="font-medium">
                          {request.bookedProvider}
                        </div>
                      </div>
                      <Link
                        href={`/my-requests/${request.id}`}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
                      >
                        {t("viewDetails")}
                      </Link>
                    </>
                  )}
                  {request.status === "completed" && (
                    <>
                      <div className="text-right text-sm">
                        <div className="text-muted">{t("completedOn")}</div>
                        <div className="font-medium">{request.completedAt}</div>
                      </div>
                      <button className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90">
                        {t("rate")}
                      </button>
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
