"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components";
import { useAuth } from "@/contexts";
import { requestsApi, type ServiceRequest } from "@/lib/api";

const mockRequest = {
  id: "1",
  title: "Apartment cleaning needed (80sqm)",
  category: "Cleaning",
  status: "active",
  createdAt: "January 10, 2026",
  location: "10115 Berlin",
  description:
    "I need a thorough cleaning of my 3-room apartment (approx. 80sqm). Kitchen and bathroom should be cleaned especially thoroughly. Windows do not need to be cleaned.",
  preferredDate: "Flexible",
  budget: "€100-150",
};

const mockQuotes = [
  {
    id: "1",
    provider: {
      name: "Smith Services",
      contact: "John Smith",
      rating: 4.9,
      reviews: 127,
      memberSince: "2023",
      image: null,
    },
    price: 120,
    message:
      "Hello! I would be happy to take care of the cleaning. With over 10 years of experience, I guarantee you the best quality. I bring all cleaning supplies.",
    validUntil: "January 17, 2026",
    createdAt: "2 hours ago",
  },
  {
    id: "2",
    provider: {
      name: "Johnson Cleaning",
      contact: "Anna Johnson",
      rating: 4.8,
      reviews: 89,
      memberSince: "2024",
      image: null,
    },
    price: 135,
    message:
      "Hi! My team and I would love to make your apartment shine. We only use eco-friendly cleaning products.",
    validUntil: "January 18, 2026",
    createdAt: "5 hours ago",
  },
  {
    id: "3",
    provider: {
      name: "Clean & Fresh",
      contact: "Thomas Weber",
      rating: 4.7,
      reviews: 156,
      memberSince: "2022",
      image: null,
    },
    price: 110,
    message:
      "Dear customer, I would be happy to provide you with a quote. The cleaning can be done on short notice.",
    validUntil: "January 16, 2026",
    createdAt: "1 day ago",
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
  category: request.categoryId,
  status: mapApiStatus(request.status),
  createdAt: new Date(request.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }),
  location: `${request.postalCode} ${request.city}`,
  description: request.description,
  preferredDate: request.preferredDate
    ? new Date(request.preferredDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Flexible",
  budget:
    request.budgetMin && request.budgetMax
      ? `€${request.budgetMin}-${request.budgetMax}`
      : request.budgetMin
        ? `€${request.budgetMin}+`
        : request.budgetMax
          ? `Up to €${request.budgetMax}`
          : "Flexible",
});

export default function RequestDetailPage() {
  const t = useTranslations("customer.requestDetail");
  const tRequests = useTranslations("customer.requests");
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [request, setRequest] = useState(mockRequest);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const requestId = params.id as string;

  const getAccessToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("armut_access_token");
  };

  useEffect(() => {
    const fetchRequest = async () => {
      if (!requestId) {
        setIsLoading(false);
        return;
      }

      try {
        const apiRequest = await requestsApi.getById(requestId);
        if (apiRequest) {
          setRequest(transformRequest(apiRequest));
        }
      } catch (err) {
        console.error("Failed to fetch request:", err);
        // If it's a mock ID (like "1", "2", etc.), use mock data
        if (requestId === mockRequest.id) {
          // Keep using mock data
        } else {
          setError(err instanceof Error ? err.message : "Failed to load request");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchRequest();
  }, [requestId, isAuthenticated]);

  const handleAcceptQuote = (quoteId: string) => {
    // Handle quote acceptance
    alert(t("acceptingQuote"));
  };

  const handleCloseRequest = async () => {
    const token = getAccessToken();
    if (!token) {
      setError("You must be logged in to close a request");
      return;
    }

    setIsClosing(true);
    try {
      await requestsApi.cancel(requestId, token);
      setShowCloseConfirm(false);
      router.push("/my-requests");
    } catch (err) {
      console.error("Failed to close request:", err);
      setError(err instanceof Error ? err.message : t("closeError"));
      setShowCloseConfirm(false);
    } finally {
      setIsClosing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 text-4xl">⏳</div>
              <p className="text-muted">{tRequests("loading")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
            {error}
          </div>
        )}

        <nav className="mb-6 text-sm text-muted">
          <Link href="/my-requests" className="hover:text-primary">
            {tRequests("myRequests")}
          </Link>
          {" / "}
          <span>{tRequests("requestDetails")}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Request Details */}
          <aside className="lg:col-span-1">
            <div className="sticky top-8 rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  {tRequests(`status.${request.status}`)}
                </span>
                <span className="text-sm text-muted">{request.category}</span>
              </div>

              <h1 className="mb-4 text-xl font-bold">{request.title}</h1>

              <p className="mb-6 text-muted">{request.description}</p>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t("location")}</span>
                  <span>{request.location}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t("preferredDate")}</span>
                  <span>{request.preferredDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t("budget")}</span>
                  <span>{request.budget}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{t("createdOn")}</span>
                  <span>{request.createdAt}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-background">
                  {t("edit")}
                </button>
                <button
                  onClick={() => setShowCloseConfirm(true)}
                  className="flex-1 rounded-lg border border-error py-2 text-sm font-medium text-error hover:bg-error/5"
                >
                  {t("close")}
                </button>
              </div>

              {/* Close Confirmation Modal */}
              {showCloseConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                    <h3 className="mb-2 text-lg font-semibold">
                      {t("closeConfirmTitle")}
                    </h3>
                    <p className="mb-6 text-muted">
                      {t("closeConfirmMessage")}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowCloseConfirm(false)}
                        disabled={isClosing}
                        className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-background disabled:opacity-50"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        onClick={handleCloseRequest}
                        disabled={isClosing}
                        className="flex-1 rounded-lg bg-error py-2 text-sm font-medium text-white hover:bg-error/90 disabled:opacity-50"
                      >
                        {isClosing ? t("closing") : t("confirm")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Quotes */}
          <div className="lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {t("quotesReceived", { count: mockQuotes.length })}
              </h2>
              <select className="rounded-lg border border-border px-3 py-2 text-sm">
                <option>{t("sortOptions.priceAsc")}</option>
                <option>{t("sortOptions.priceDesc")}</option>
                <option>{t("sortOptions.bestRating")}</option>
                <option>{t("sortOptions.newest")}</option>
              </select>
            </div>

            <div className="space-y-4">
              {mockQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className={`rounded-xl bg-white p-6 shadow-sm transition ${
                    selectedQuote === quote.id
                      ? "ring-2 ring-primary"
                      : "hover:shadow-md"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {/* Provider Info */}
                    <div className="flex flex-1 gap-4">
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-white">
                        {quote.provider.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{quote.provider.name}</h3>
                        <p className="text-sm text-muted">
                          {quote.provider.contact}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-sm">
                          <span className="text-yellow-500">★</span>
                          <span className="font-medium">
                            {quote.provider.rating}
                          </span>
                          <span className="text-muted">
                            ({quote.provider.reviews} {t("reviews")})
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {t("memberSince")} {quote.provider.memberSince}
                        </p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {quote.price}€
                      </div>
                      <div className="text-sm text-muted">{t("fixedPrice")}</div>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="mt-4 rounded-lg bg-background p-4">
                    <p className="text-sm text-muted">{quote.message}</p>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted">
                      {t("validUntil")} {quote.validUntil} • {quote.createdAt}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/messages?provider=${quote.id}`}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
                      >
                        {t("sendMessage")}
                      </Link>
                      <button
                        onClick={() => handleAcceptQuote(quote.id)}
                        className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90"
                      >
                        {t("acceptQuote")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tips */}
            <div className="mt-8 rounded-xl bg-primary/5 p-6">
              <h3 className="mb-3 font-semibold">{t("tips.title")}</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  {t("tips.tip1")}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  {t("tips.tip2")}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  {t("tips.tip3")}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
