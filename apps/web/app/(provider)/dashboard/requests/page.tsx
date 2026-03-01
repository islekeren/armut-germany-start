"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertBanner, PanelCard, ProviderSubpageShell } from "@/components";
import {
  getStoredAccessToken,
  providerApi,
  ProviderRequest,
  quotesApi,
} from "@/lib/api";

export default function RequestsPage() {
  const t = useTranslations("provider.requests");
  const tNav = useTranslations("provider.dashboard.navigation");
  const tCat = useTranslations("categories");
  const [filter, setFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [requests, setRequests] = useState<ProviderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteSuccess, setQuoteSuccess] = useState<string | null>(null);
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteModalRequest, setQuoteModalRequest] = useState<ProviderRequest | null>(
    null
  );
  const [quoteForm, setQuoteForm] = useState({
    price: "",
    message: "",
    validUntil: "",
  });

  const filters = ["all", "cleaning", "renovation", "garden"];

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getStoredAccessToken();
        if (token) {
          const category = filter === "all" ? undefined : filter;
          const response = await providerApi.getRequests(token, { category });
          setRequests(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch requests", error);
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [filter, t]);

  const getDefaultValidUntil = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split("T")[0] || "";
  };

  const openQuoteModal = (request: ProviderRequest) => {
    setQuoteError(null);
    setQuoteSuccess(null);
    setQuoteModalRequest(request);
    setQuoteForm({
      price: request.budgetMin ? request.budgetMin.toString() : "",
      message: "",
      validUntil: getDefaultValidUntil(),
    });
  };

  const closeQuoteModal = () => {
    if (isSubmittingQuote) return;
    setQuoteModalRequest(null);
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteModalRequest) return;

    const token = getStoredAccessToken();
    if (!token) {
      setQuoteError(t("authRequired"));
      return;
    }

    const numericPrice = Number(quoteForm.price);
    if (!numericPrice || numericPrice <= 0) {
      setQuoteError(t("invalidPrice"));
      return;
    }

    if (!quoteForm.message.trim()) {
      setQuoteError(t("invalidMessage"));
      return;
    }

    setIsSubmittingQuote(true);
    setQuoteError(null);

    try {
      await quotesApi.create(token, {
        requestId: quoteModalRequest.id,
        price: numericPrice,
        message: quoteForm.message.trim(),
        validUntil: quoteForm.validUntil,
      });

      setRequests((prev) => prev.filter((item) => item.id !== quoteModalRequest.id));
      setQuoteSuccess(t("quoteSent"));
      setQuoteModalRequest(null);
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : t("quoteError"));
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    return "now";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        {t("loading") || "Loading..."}
      </div>
    );
  }

  return (
    <ProviderSubpageShell
      title={t("title")}
      backLabel={tNav("overview")}
      headerSlot={
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted">{t("subtitle", { count: requests.length })}</p>
          </div>
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                  filter === f
                    ? "bg-primary text-white"
                    : "bg-white text-muted hover:bg-background"
                }`}
              >
                {t(`filters.${f}`)}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {error && (
        <AlertBanner variant="warning" className="mb-6">
          {error}
        </AlertBanner>
      )}

      {quoteSuccess && (
        <AlertBanner variant="success" className="mb-6">
          {quoteSuccess}
        </AlertBanner>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
          {/* Requests List */}
          <div className="space-y-4 lg:col-span-2">
            {requests.length === 0 ? (
              <PanelCard className="p-8 text-center">
                <div className="text-4xl mb-4">📭</div>
                <p className="text-muted">{t("noRequests") || "No requests found"}</p>
              </PanelCard>
            ) : (
              requests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => setSelectedRequest(request.id)}
                  className={`cursor-pointer rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md ${
                    selectedRequest === request.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                         {tCat(`${request.category}.name`)}
                      </span>
                      <h3 className="mt-2 text-lg font-semibold">
                        {request.title}
                      </h3>
                    </div>
                    <span className="text-sm text-muted">{t("postedAt", { time: getTimeAgo(request.createdAt) })}</span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-muted">
                    {request.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-muted">
                      📍 {request.location}
                    </span>
                    <span className="flex items-center gap-1 text-muted">
                      📅 {request.preferredDate ? new Date(request.preferredDate).toLocaleDateString() : "Flexibel"}
                    </span>
                    {request.budget && (
                      <span className="font-semibold text-secondary">
                        💰 {request.budget}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-white">
                        {request.customer.name.charAt(0)}
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{request.customer.name}</div>
                        <div className="text-muted">
                           {t("memberSince", { year: request.customer.memberSince })}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openQuoteModal(request);
                      }}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                    >
                      {t("sendOffer")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <PanelCard className="sticky top-8">
              <h3 className="mb-4 font-semibold">{t("tips.title")}</h3>
              <ul className="space-y-3 text-sm text-muted">
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
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  {t("tips.tip4")}
                </li>
              </ul>

              <div className="mt-6 rounded-lg bg-secondary/10 p-4">
                <div className="text-2xl font-bold text-secondary">87%</div>
                <div className="text-sm text-muted">
                   {t("acceptanceRate")}
                </div>
              </div>
            </PanelCard>
          </aside>
        </div>

      {quoteModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold">{t("sendOffer")}</h2>
            <p className="mt-1 text-sm text-muted">{quoteModalRequest.title}</p>

            <form onSubmit={handleSubmitQuote} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("quotePrice")}
                </label>
                <input
                  type="number"
                  min="1"
                  value={quoteForm.price}
                  onChange={(e) =>
                    setQuoteForm((prev) => ({ ...prev, price: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("quoteMessage")}
                </label>
                <textarea
                  rows={4}
                  value={quoteForm.message}
                  onChange={(e) =>
                    setQuoteForm((prev) => ({ ...prev, message: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  placeholder={t("quoteMessagePlaceholder")}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("validUntil")}
                </label>
                <input
                  type="date"
                  value={quoteForm.validUntil}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setQuoteForm((prev) => ({ ...prev, validUntil: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                  required
                />
              </div>

              {quoteError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {quoteError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeQuoteModal}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
                  disabled={isSubmittingQuote}
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                  disabled={isSubmittingQuote}
                >
                  {isSubmittingQuote ? t("sendingOffer") : t("sendOffer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProviderSubpageShell>
  );
}
