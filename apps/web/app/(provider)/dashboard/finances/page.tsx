"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertBanner, PanelCard, ProviderSubpageShell } from "@/components";
import {
  getStoredAccessToken,
  providerApi,
  type StripeAccountStatus,
} from "@/lib/api";

export default function ProviderFinancesPage() {
  const searchParams = useSearchParams();
  const tNav = useTranslations("provider.dashboard.navigation");
  const t = useTranslations("provider.finances");
  const [status, setStatus] = useState<StripeAccountStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError(t("loginRequired"));
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setStatus(await providerApi.getStripeStatus(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  const openOnboarding = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setError(t("loginRequired"));
      return;
    }

    setIsActing(true);
    setError(null);
    try {
      if (!status?.accountId) {
        await providerApi.createStripeAccount(token);
      }
      const link = await providerApi.createStripeOnboardingLink(token);
      window.location.assign(link.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("actionError"));
      setIsActing(false);
    }
  }, [status?.accountId, t]);

  useEffect(() => {
    if (searchParams.get("stripe") === "refresh") {
      openOnboarding();
      return;
    }
    loadStatus();
  }, [loadStatus, openOnboarding, searchParams]);

  const onboardingStatus = status?.onboardingStatus ?? "not_started";
  const primaryLabel =
    onboardingStatus === "not_started"
      ? t("actions.connect")
      : t("actions.continue");

  return (
    <ProviderSubpageShell title={tNav("finances")} backLabel={tNav("overview")}>
      <div className="space-y-6">
        {error ? <AlertBanner variant="warning">{error}</AlertBanner> : null}

        {searchParams.get("stripe") === "return" ? (
          <AlertBanner variant="success">{t("returned")}</AlertBanner>
        ) : null}

        <PanelCard>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full ${
                    onboardingStatus === "ready"
                      ? "bg-emerald-500"
                      : onboardingStatus === "restricted"
                        ? "bg-rose-500"
                        : "bg-amber-500"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {t(`status.${onboardingStatus}.label`)}
                </span>
              </div>
              <h2 className="text-xl font-semibold">{t("title")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {isLoading
                  ? t("loading")
                  : t(`status.${onboardingStatus}.description`)}
              </p>
            </div>

            <div className="flex min-w-48 flex-col gap-3">
              {onboardingStatus !== "ready" ? (
                <button
                  type="button"
                  onClick={openOnboarding}
                  disabled={isLoading || isActing}
                  className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isActing ? t("actions.opening") : primaryLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={loadStatus}
                disabled={isLoading || isActing}
                className="rounded-lg border border-border px-4 py-3 text-sm font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("actions.refresh")}
              </button>
            </div>
          </div>
        </PanelCard>

        <PanelCard>
          <h3 className="font-semibold">{t("demoTitle")}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{t("demoHint")}</p>
        </PanelCard>
      </div>
    </ProviderSubpageShell>
  );
}
