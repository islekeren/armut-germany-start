"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { providerApi, ProviderRequest } from "@/lib/api";

export default function RequestsPage() {
  const t = useTranslations("provider.requests");
  const tNav = useTranslations("provider.dashboard.navigation");
  const tCat = useTranslations("categories");
  const [filter, setFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [requests, setRequests] = useState<ProviderRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const filters = ["all", "cleaning", "renovation", "garden"];

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const token = localStorage.getItem("armut_access_token");
        if (token) {
          const category = filter === "all" ? undefined : filter;
          const response = await providerApi.getRequests(token, { category });
          setRequests(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch requests", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [filter]);

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">Armut</span>
              <span className="text-sm text-muted">Pro</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-muted hover:text-foreground"
              >
                {tNav("overview")}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-primary">
            {tNav("overview")}
          </Link>
          {" / "}
          <span>{t("title")}</span>
        </nav>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted">
              {t("subtitle", { count: requests.length })}
            </p>
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

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Requests List */}
          <div className="space-y-4 lg:col-span-2">
            {requests.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center shadow-sm">
                <div className="text-4xl mb-4">📭</div>
                <p className="text-muted">{t("noRequests") || "No requests found"}</p>
              </div>
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
                        // Open quote modal
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
            <div className="sticky top-8 rounded-xl bg-white p-6 shadow-sm">
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
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
