"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner, Header, PanelCard } from "@/components";
import { requestsApi, type ServiceRequest } from "@/lib/api";
import {
  getBranchById,
  getBranchLabel,
  getFallbackBranchByCategorySlug,
  getSectorById,
  getSectorLabel,
} from "@/lib/request-taxonomy";

export default function RequestsPage() {
  const t = useTranslations("requestsPage");
  const locale = useLocale();
  const tCat = useTranslations("categories");
  const [filter, setFilter] = useState("all");
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await requestsApi.getAll({ status: "open", limit: 100 });
        setRequests(response.data);
      } catch (err) {
        console.error("Failed to fetch open requests", err);
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [t]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, number>();
    requests.forEach((request) => {
      const slug = request.category?.slug;
      if (!slug) return;
      map.set(slug, (map.get(slug) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((request) => request.category?.slug === filter);
  }, [filter, requests]);

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

  const getCategoryName = (request: ServiceRequest) => {
    if (!request.category) return "";
    if (locale.startsWith("de")) return request.category.nameDe;
    return request.category.nameEn;
  };

  const getCategoryLabel = (slug?: string, fallback?: string) => {
    if (!slug) return fallback || "";
    try {
      return tCat(`${slug}.name`);
    } catch {
      return fallback || slug;
    }
  };

  const getBudgetText = (request: ServiceRequest) => {
    if (request.budgetMin != null && request.budgetMax != null) {
      return `€${request.budgetMin}-€${request.budgetMax}`;
    }
    if (request.budgetMin != null) {
      return `€${request.budgetMin}+`;
    }
    if (request.budgetMax != null) {
      return t("budgetUpTo", { value: request.budgetMax });
    }
    return null;
  };

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                filter === "all"
                  ? "bg-primary text-white"
                  : "bg-white text-muted hover:bg-slate-50"
              }`}
            >
              {t("filters.all")}
            </button>
            {categoryOptions.map(([item]) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                  filter === item
                    ? "bg-primary text-white"
                    : "bg-white text-muted hover:bg-slate-50"
                }`}
              >
                {getCategoryLabel(item, item)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <AlertBanner variant="warning" className="mb-6">
            {error}
          </AlertBanner>
        )}

        {loading ? (
          <div className="flex h-40 items-center justify-center">{t("loading")}</div>
        ) : filteredRequests.length === 0 ? (
          <PanelCard className="p-10 text-center text-muted">{t("noRequests")}</PanelCard>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <PanelCard key={request.id} className="p-5">
                {(() => {
                  const branch =
                    getBranchById(request.requestBranch) ||
                    getFallbackBranchByCategorySlug(request.category?.slug);
                  const sector =
                    getSectorById(request.requestSector) ||
                    getSectorById(branch?.sectorId);

                  if (!branch && !sector) return null;

                  return (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {sector && (
                        <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary">
                          {getSectorLabel(sector, locale)}
                        </span>
                      )}
                      {branch && (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {getBranchLabel(branch, locale)}
                        </span>
                      )}
                    </div>
                  );
                })()}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {request.category?.slug ? (
                      <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        {getCategoryLabel(request.category.slug, request.category.nameEn)}
                      </span>
                    ) : null}
                    <h2 className="mt-2 text-lg font-semibold">{request.title}</h2>
                  </div>
                  <span className="text-sm text-muted">{t("postedAt", { time: getTimeAgo(request.createdAt) })}</span>
                </div>

                <p className="mt-2 text-muted">{request.description}</p>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <span className="text-muted">📍 {request.postalCode} {request.city}</span>
                  <span className="text-muted">
                    📅{" "}
                    {request.preferredDate
                      ? new Date(request.preferredDate).toLocaleDateString()
                      : t("flexible")}
                  </span>
                  {getBudgetText(request) ? (
                    <span className="font-semibold text-secondary">💰 {getBudgetText(request)}</span>
                  ) : null}
                </div>

                <div className="mt-4 border-t border-border pt-3 text-sm text-muted">
                  {getCategoryName(request)}
                </div>
              </PanelCard>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
