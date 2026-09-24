"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner, Header } from "@/components";
import { useAuth } from "@/contexts";
import {
  adminApi,
  getStoredAccessToken,
  type PendingProvider,
} from "@/lib/api";
import { useApiErrorMessage } from "@/lib/api-errors";

export default function AdminProvidersPage() {
  const t = useTranslations("admin.providers");
  const describeError = useApiErrorMessage();
  const locale = useLocale();
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [providers, setProviders] = useState<PendingProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = user?.userType === "admin";

  const loadProviders = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const response = await adminApi.getPendingProviders(token);
      setProviders(response.data);
    } catch (err) {
      setError(describeError(err, t("loadError")));
    } finally {
      setLoading(false);
    }
  }, [t, describeError]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace("/login?redirect=/admin/providers");
      return;
    }
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadProviders();
  }, [authLoading, isAdmin, isAuthenticated, loadProviders, router]);

  // There is no "rejected" state in the schema yet, so the page only approves;
  // providers that should not be approved simply stay pending.
  const approve = async (provider: PendingProvider) => {
    const token = getStoredAccessToken();
    if (!token) return;

    setBusyId(provider.id);
    setError(null);
    setSuccess(null);
    try {
      await adminApi.setProviderApproval(token, provider.id, true);
      setProviders((prev) => prev.filter((item) => item.id !== provider.id));
      setSuccess(
        t("approved", { name: provider.companyName || provider.user.email }),
      );
    } catch (err) {
      setError(describeError(err, t("actionError")));
    } finally {
      setBusyId(null);
    }
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(value));

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted">{t("subtitle")}</p>
        </div>

        {!authLoading && isAuthenticated && !isAdmin && (
          <AlertBanner variant="error">{t("forbidden")}</AlertBanner>
        )}

        {error && (
          <AlertBanner variant="error" className="mb-4">
            {error}
          </AlertBanner>
        )}
        {success && (
          <AlertBanner variant="success" className="mb-4">
            {success}
          </AlertBanner>
        )}

        {isAdmin && loading && (
          <p className="text-sm text-muted">{t("loading")}</p>
        )}

        {isAdmin && !loading && providers.length === 0 && !error && (
          <div className="rounded-xl bg-white p-10 text-center shadow-sm">
            <p className="text-muted">{t("empty")}</p>
          </div>
        )}

        {isAdmin && !loading && providers.length > 0 && (
          <div className="space-y-4">
            {providers.map((provider) => {
              const categories = (provider.services ?? [])
                .map((service) =>
                  locale === "de"
                    ? service.category?.nameDe
                    : service.category?.nameEn,
                )
                .filter(Boolean)
                .join(", ");
              const location = [
                provider.profile?.postalCode,
                provider.profile?.city,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div
                  key={provider.id}
                  className="rounded-xl bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-foreground">
                        {provider.companyName ||
                          `${provider.user.firstName} ${provider.user.lastName}`}
                      </h2>
                      <p className="text-sm text-muted">
                        {provider.user.firstName} {provider.user.lastName} ·{" "}
                        {provider.user.email}
                        {provider.user.phone ? ` · ${provider.user.phone}` : ""}
                      </p>
                      <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="inline text-muted">
                            {t("location")}:{" "}
                          </dt>
                          <dd className="inline">{location || "–"}</dd>
                        </div>
                        <div>
                          <dt className="inline text-muted">
                            {t("experience")}:{" "}
                          </dt>
                          <dd className="inline">
                            {t("years", { count: provider.experienceYears })}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="inline text-muted">
                            {t("categories")}:{" "}
                          </dt>
                          <dd className="inline">{categories || "–"}</dd>
                        </div>
                        <div>
                          <dt className="inline text-muted">
                            {t("registeredAt")}:{" "}
                          </dt>
                          <dd className="inline">
                            {formatDate(provider.createdAt)}
                          </dd>
                        </div>
                      </dl>
                      {provider.description && (
                        <p className="mt-3 whitespace-pre-line text-sm text-foreground">
                          {provider.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => approve(provider)}
                        disabled={busyId === provider.id}
                        className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white hover:bg-secondary/90 disabled:opacity-50"
                      >
                        {t("approve")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
