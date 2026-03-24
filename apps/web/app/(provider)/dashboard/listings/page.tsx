"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertBanner, PanelCard, ProviderSubpageShell } from "@/components";
import {
  getStoredAccessToken,
  providerApi,
  quotesApi,
  type ProviderRequest,
} from "@/lib/api";

type DateFilter = "all" | "today" | "last7" | "thisMonth";
type SortFilter = "newest" | "oldest" | "budgetAsc" | "budgetDesc";

function getBudgetValue(request: ProviderRequest) {
  if (typeof request.budgetMin === "number") return request.budgetMin;
  if (typeof request.budgetMax === "number") return request.budgetMax;
  if (!request.budget) return null;
  const match = request.budget.replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export default function ListingsPage() {
  const t = useTranslations("provider.requests");
  const tNav = useTranslations("provider.dashboard.navigation");
  const tCat = useTranslations("categories");
  const tFilters = useTranslations("provider.offers.filters");
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [allRequests, setAllRequests] = useState<ProviderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [offerValidUntil, setOfferValidUntil] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);

  const [category, setCategory] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortBy, setSortBy] = useState<SortFilter>("newest");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getStoredAccessToken();
        if (!token) {
          setAllRequests([]);
          setError(t("authRequired"));
          return;
        }

        const response = await providerApi.getRequests(token, {
          page: 1,
          limit: 100,
        });
        setAllRequests(response.data);
      } catch (fetchError) {
        console.error("Failed to fetch requests", fetchError);
        setError(
          fetchError instanceof Error ? fetchError.message : t("loadError"),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [t]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, number>();
    allRequests.forEach((request) => {
      map.set(request.category, (map.get(request.category) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allRequests]);

  const getCategoryLabel = (slug: string, fallback: string) => {
    try {
      return tCat(`${slug}.name`);
    } catch {
      return fallback;
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

  const matchesDateFilter = (request: ProviderRequest) => {
    if (dateFilter === "all") return true;
    const createdAt = new Date(request.createdAt);
    const now = new Date();

    if (dateFilter === "today")
      return createdAt.toDateString() === now.toDateString();
    if (dateFilter === "last7") {
      const threshold = new Date();
      threshold.setDate(now.getDate() - 7);
      return createdAt >= threshold;
    }
    return (
      createdAt.getMonth() === now.getMonth() &&
      createdAt.getFullYear() === now.getFullYear()
    );
  };

  const filteredRequests = useMemo(() => {
    const min = minBudget ? Number(minBudget) : null;
    const max = maxBudget ? Number(maxBudget) : null;
    const term = search.trim().toLowerCase();

    const filtered = allRequests.filter((request) => {
      if (category !== "all" && request.category !== category) return false;
      if (!matchesDateFilter(request)) return false;

      const budgetValue = getBudgetValue(request);
      if (min !== null && budgetValue !== null && budgetValue < min)
        return false;
      if (max !== null && budgetValue !== null && budgetValue > max)
        return false;

      if (term) {
        const haystack =
          `${request.title} ${request.description} ${request.location} ${request.categoryName}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortBy === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      if (sortBy === "budgetAsc") {
        return (
          (getBudgetValue(a) ?? Number.MAX_SAFE_INTEGER) -
          (getBudgetValue(b) ?? Number.MAX_SAFE_INTEGER)
        );
      }
      if (sortBy === "budgetDesc") {
        return (getBudgetValue(b) ?? -1) - (getBudgetValue(a) ?? -1);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [allRequests, category, dateFilter, maxBudget, minBudget, search, sortBy]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        {t("loading")}
      </div>
    );
  }

  const handleSelectRequest = (request: ProviderRequest) => {
    setSelectedRequest((prev) => (prev === request.id ? null : request.id));
    setSuccessMessage(null);
    setError(null);
    setOfferPrice("");
    setOfferMessage("");
    if (!offerValidUntil) {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7);
      setOfferValidUntil(validUntil.toISOString().split("T")[0] ?? "");
    }
  };

  const handleSendOffer = async (requestId: string) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError(t("authRequired"));
      return;
    }

    if (!offerPrice || Number(offerPrice) <= 0) {
      setError(t("invalidPrice"));
      return;
    }

    if (!offerMessage.trim()) {
      setError(t("invalidMessage"));
      return;
    }

    try {
      setSendingOffer(true);
      setError(null);
      setSuccessMessage(null);

      await quotesApi.create(token, {
        requestId,
        price: Number(offerPrice),
        message: offerMessage.trim(),
        validUntil:
          offerValidUntil || new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      setAllRequests((prev) => prev.filter((req) => req.id !== requestId));
      setSelectedRequest(null);
      setOfferPrice("");
      setOfferMessage("");
      setOfferValidUntil("");
      setSuccessMessage(t("quoteSent"));
    } catch (sendError) {
      console.error("Failed to send offer", sendError);
      setError(
        sendError instanceof Error ? sendError.message : t("quoteError"),
      );
    } finally {
      setSendingOffer(false);
    }
  };

  return (
    <ProviderSubpageShell
      title={t("title")}
      backLabel={tNav("overview")}
      headerSlot={
        <div className="mb-8 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted">
              {t("subtitle", { count: filteredRequests.length })}
            </p>
          </div>

          <PanelCard className="p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm text-muted">
                  {t("filters.searchLabel")}
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("filters.searchPlaceholder")}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">
                  {tFilters("date")}
                </label>
                <select
                  value={dateFilter}
                  onChange={(event) =>
                    setDateFilter(event.target.value as DateFilter)
                  }
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="all">{tFilters("dateAll")}</option>
                  <option value="today">{tFilters("dateToday")}</option>
                  <option value="last7">{tFilters("dateLast7")}</option>
                  <option value="thisMonth">{tFilters("dateThisMonth")}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">
                  {tFilters("priceMin")}
                </label>
                <input
                  type="number"
                  value={minBudget}
                  onChange={(event) => setMinBudget(event.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">
                  {tFilters("priceMax")}
                </label>
                <input
                  type="number"
                  value={maxBudget}
                  onChange={(event) => setMaxBudget(event.target.value)}
                  placeholder="1000"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCategory("all")}
                className={`rounded-full px-4 py-2 text-sm font-medium ${category === "all" ? "bg-primary text-white" : "bg-background text-muted hover:bg-white"}`}
              >
                {t("filters.all")} ({allRequests.length})
              </button>
              {categoryOptions.map(([slug, count]) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => setCategory(slug)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${category === slug ? "bg-primary text-white" : "bg-background text-muted hover:bg-white"}`}
                >
                  {getCategoryLabel(slug, slug)} ({count})
                </button>
              ))}
              <div className="ml-auto w-full md:w-56">
                <label className="mb-1 block text-sm text-muted">
                  {tFilters("sortBy")}
                </label>
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as SortFilter)
                  }
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="newest">{tFilters("sortNewest")}</option>
                  <option value="oldest">{tFilters("sortOldest")}</option>
                  <option value="budgetAsc">{tFilters("sortPriceAsc")}</option>
                  <option value="budgetDesc">
                    {tFilters("sortPriceDesc")}
                  </option>
                </select>
              </div>
            </div>
          </PanelCard>
        </div>
      }
    >
      {error && (
        <AlertBanner variant="warning" className="mb-6">
          {error}
        </AlertBanner>
      )}
      {successMessage && (
        <AlertBanner variant="success" className="mb-6">
          {successMessage}
        </AlertBanner>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {filteredRequests.length === 0 ? (
            <PanelCard className="p-8 text-center">
              <div className="mb-4 text-4xl">📭</div>
              <p className="text-muted">{t("noRequests")}</p>
            </PanelCard>
          ) : (
            filteredRequests.map((request) => (
              <div
                key={request.id}
                onClick={() => handleSelectRequest(request)}
                className={`cursor-pointer rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md ${
                  selectedRequest === request.id ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {getCategoryLabel(request.category, request.categoryName)}
                    </span>
                    <h3 className="mt-2 text-lg font-semibold">
                      {request.title}
                    </h3>
                  </div>
                  <span className="text-sm text-muted">
                    {t("postedAt", { time: getTimeAgo(request.createdAt) })}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-muted">
                  {request.description}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-muted">
                    📍 {request.location}
                  </span>
                  <span className="flex items-center gap-1 text-muted">
                    📅{" "}
                    {request.preferredDate
                      ? new Date(request.preferredDate).toLocaleDateString()
                      : t("flexible")}
                  </span>
                  {request.budget ? (
                    <span className="font-semibold text-secondary">
                      💰 {request.budget}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-white">
                      {request.customer.name.charAt(0)}
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{request.customer.name}</div>
                      <div className="text-muted">
                        {t("memberSince", {
                          year: request.customer.memberSince,
                        })}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-muted">
                    #{request.id.slice(0, 8)}
                  </span>
                </div>

                {selectedRequest === request.id ? (
                  <div
                    className="mt-4 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-sm text-muted">
                          {t("quotePrice")}
                        </label>
                        <input
                          type="number"
                          value={offerPrice}
                          onChange={(event) =>
                            setOfferPrice(event.target.value)
                          }
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          placeholder="100"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm text-muted">
                          {t("validUntil")}
                        </label>
                        <input
                          type="date"
                          value={offerValidUntil}
                          onChange={(event) =>
                            setOfferValidUntil(event.target.value)
                          }
                          className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-muted">
                        {t("quoteMessage")}
                      </label>
                      <textarea
                        value={offerMessage}
                        onChange={(event) =>
                          setOfferMessage(event.target.value)
                        }
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:outline-none"
                        rows={3}
                        placeholder={t("quoteMessagePlaceholder")}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(null)}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-white"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendOffer(request.id)}
                        disabled={sendingOffer}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
                      >
                        {sendingOffer ? t("sendingOffer") : t("sendOffer")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

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
              <div className="text-sm text-muted">{t("acceptanceRate")}</div>
            </div>
          </PanelCard>
        </aside>
      </div>
    </ProviderSubpageShell>
  );
}
