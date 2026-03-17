"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Header } from "@/components";
import {
  bookingsApi,
  getStoredAccessToken,
  messagesApi,
  quotesApi,
  requestsApi,
  type CustomerBooking,
  type Quote,
  type ServiceRequest,
} from "@/lib/api";

type DisplayRequestStatus = "active" | "booked" | "completed" | "cancelled";
type SortOption = "priceAsc" | "priceDesc" | "bestRating" | "newest";

interface RequestViewModel {
  id: string;
  title: string;
  category: string;
  status: DisplayRequestStatus;
  createdAt: string;
  location: string;
  description: string;
  preferredDate: string;
  budget: string;
}

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

const transformRequest = (request: ServiceRequest): RequestViewModel => ({
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
  description: request.description,
  preferredDate: request.preferredDate
    ? new Date(request.preferredDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Flexible",
  budget:
    request.budgetMin !== undefined && request.budgetMax !== undefined
      ? `€${request.budgetMin}-${request.budgetMax}`
      : request.budgetMin !== undefined
        ? `€${request.budgetMin}+`
        : request.budgetMax !== undefined
          ? `Up to €${request.budgetMax}`
          : "Flexible",
});

export default function RequestDetailPage() {
  const t = useTranslations("customer.requestDetail");
  const tRequests = useTranslations("customer.requests");
  const params = useParams();
  const router = useRouter();

  const [request, setRequest] = useState<RequestViewModel | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [requestBooking, setRequestBooking] = useState<CustomerBooking | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isAcceptingQuoteId, setIsAcceptingQuoteId] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const requestId = params.id as string;

  const loadData = useCallback(async () => {
    if (!requestId) {
      setIsLoading(false);
      return;
    }

    try {
      const apiRequest = await requestsApi.getById(requestId);
      setRequest(transformRequest(apiRequest));

      const token = getStoredAccessToken();
      if (token) {
        const [quoteData, bookingData] = await Promise.all([
          quotesApi.getByRequest(token, requestId),
          bookingsApi.getCustomerBookings(token, { page: 1, limit: 100 }),
        ]);
        setQuotes(quoteData);
        setRequestBooking(
          bookingData.data.find((booking) => booking.quote?.request?.id === requestId) || null,
        );
      } else {
        setQuotes([]);
        setRequestBooking(null);
      }
    } catch (err) {
      console.error("Failed to load request details:", err);
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [requestId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sortedQuotes = useMemo(() => {
    const result = [...quotes];

    result.sort((a, b) => {
      if (sortBy === "priceAsc") return a.price - b.price;
      if (sortBy === "priceDesc") return b.price - a.price;
      if (sortBy === "bestRating") {
        return (b.provider?.ratingAvg || 0) - (a.provider?.ratingAvg || 0);
      }
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return result;
  }, [quotes, sortBy]);

  const handleAcceptQuote = async (quoteId: string) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError(t("loginRequired"));
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsAcceptingQuoteId(quoteId);

    try {
      await quotesApi.respond(token, quoteId, "accepted");
      router.push(`/bookings/new?quote=${quoteId}&accepted=1`);
    } catch (err) {
      console.error("Failed to accept quote:", err);
      setError(err instanceof Error ? err.message : t("acceptError"));
    } finally {
      setIsAcceptingQuoteId(null);
    }
  };

  const handleBookingAction = (quoteId: string) => {
    if (requestBooking) {
      router.push(`/bookings/${requestBooking.id}`);
      return;
    }

    router.push(`/bookings/new?quote=${quoteId}`);
  };

  const handleSendMessage = async (quote: Quote) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError(t("loginRequired"));
      return;
    }

    const participantId = quote.provider?.user.id;
    if (!participantId) {
      setError(t("messageError"));
      return;
    }

    try {
      const conversation = await messagesApi.createConversation(token, {
        participantId,
        requestId,
      });
      router.push(`/messages?conversation=${conversation.id}`);
    } catch (err) {
      console.error("Failed to open conversation:", err);
      setError(err instanceof Error ? err.message : t("messageError"));
    }
  };

  const handleCloseRequest = async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError(t("loginRequired"));
      return;
    }

    setIsClosing(true);
    setError(null);

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

  if (!request) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
            {error || t("loadError")}
          </div>
        </div>
      </div>
    );
  }

  const acceptedQuote = quotes.find((quote) => quote.status === "accepted");

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            {successMessage}
          </div>
        )}
        {acceptedQuote && (
          <div className="mb-6 flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-blue-800">{t("bookingReadyTitle")}</div>
              <p className="text-sm text-blue-700">{t("bookingReadyText")}</p>
            </div>
            <button
              onClick={() => handleBookingAction(acceptedQuote.id)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
              {requestBooking ? t("viewBooking") : t("completeBooking")}
            </button>
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

              {request.status === "active" && (
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
              )}

              {showCloseConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                  <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                    <h3 className="mb-2 text-lg font-semibold">
                      {t("closeConfirmTitle")}
                    </h3>
                    <p className="mb-6 text-muted">{t("closeConfirmMessage")}</p>
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

          <div className="lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {t("quotesReceived", { count: quotes.length })}
              </h2>
              <select
                className="rounded-lg border border-border px-3 py-2 text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="priceAsc">{t("sortOptions.priceAsc")}</option>
                <option value="priceDesc">{t("sortOptions.priceDesc")}</option>
                <option value="bestRating">{t("sortOptions.bestRating")}</option>
                <option value="newest">{t("sortOptions.newest")}</option>
              </select>
            </div>

            {sortedQuotes.length === 0 && (
              <div className="rounded-xl bg-white p-8 text-center text-muted shadow-sm">
                {t("noQuotes")}
              </div>
            )}

            <div className="space-y-4">
              {sortedQuotes.map((quote) => {
                const providerName =
                  quote.provider?.companyName ||
                  `${quote.provider?.user.firstName || ""} ${
                    quote.provider?.user.lastName || ""
                  }`.trim() ||
                  "Provider";
                const providerContact = `${quote.provider?.user.firstName || ""} ${
                  quote.provider?.user.lastName || ""
                }`.trim();
                const createdAt = new Date(quote.createdAt).toLocaleString();
                const validUntil = new Date(quote.validUntil).toLocaleDateString();
                const canAccept = quote.status === "pending";
                const canBook = quote.status === "accepted";

                return (
                  <div
                    key={quote.id}
                    onClick={() => setSelectedQuote(quote.id)}
                    className={`rounded-xl bg-white p-6 shadow-sm transition ${
                      selectedQuote === quote.id ? "ring-2 ring-primary" : "hover:shadow-md"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="flex flex-1 gap-4">
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-white">
                          {providerName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{providerName}</h3>
                          <p className="text-sm text-muted">{providerContact}</p>
                          <div className="mt-1 flex items-center gap-2 text-sm">
                            <span className="text-yellow-500">★</span>
                            <span className="font-medium">
                              {quote.provider?.ratingAvg?.toFixed(1) || "-"}
                            </span>
                            <span className="text-muted">
                              ({quote.provider?.totalReviews || 0} {t("reviews")})
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {t("memberSince")} -
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{quote.price}€</div>
                        <div className="text-sm text-muted">{t("fixedPrice")}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg bg-background p-4">
                      <p className="text-sm text-muted">{quote.message}</p>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-muted">
                        {t("validUntil")} {validUntil} • {createdAt}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSendMessage(quote)}
                          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
                        >
                          {t("sendMessage")}
                        </button>
                        <button
                          onClick={() =>
                            canAccept
                              ? handleAcceptQuote(quote.id)
                              : canBook
                                ? handleBookingAction(quote.id)
                                : undefined
                          }
                          disabled={
                            isAcceptingQuoteId === quote.id || (!canAccept && !canBook)
                          }
                          className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-white hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isAcceptingQuoteId === quote.id
                            ? t("acceptingQuote")
                            : canAccept
                              ? t("acceptQuote")
                              : canBook
                                ? requestBooking
                                  ? t("viewBooking")
                                  : t("completeBooking")
                                : t(`quoteStatus.${quote.status}`)}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

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
