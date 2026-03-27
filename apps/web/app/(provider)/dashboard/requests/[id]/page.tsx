"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner, PanelCard, ProviderSubpageShell } from "@/components";
import { requestsApi, type ServiceRequest } from "@/lib/api";
import {
  getBranchById,
  getBranchLabel,
  getFallbackBranchByCategorySlug,
  getSectorById,
  getSectorLabel,
} from "@/lib/request-taxonomy";

export default function ProviderRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations("provider.requestDetail");
  const tNav = useTranslations("provider.dashboard.navigation");
  const locale = useLocale();
  const requestId = params?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<ServiceRequest | null>(null);

  useEffect(() => {
    const loadRequest = async () => {
      if (!requestId) return;

      setLoading(true);
      setError(null);
      try {
        const data = await requestsApi.getById(requestId);
        setRequest(data);
      } catch (err) {
        console.error("Failed to load request detail", err);
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    };

    loadRequest();
  }, [requestId, t]);

  return (
    <ProviderSubpageShell
      title={t("title")}
      backLabel={tNav("requests")}
      backHref="/dashboard/listings"
      breadcrumbLabel={request?.title || t("title")}
    >
      {error && (
        <AlertBanner variant="warning" className="mb-6">
          {error}
        </AlertBanner>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">{t("loading")}</div>
      ) : !request ? (
        <PanelCard>
          <p className="text-sm text-muted">{t("notFound")}</p>
        </PanelCard>
      ) : (
        <div className="space-y-6">
          {(() => {
            const branch =
              getBranchById(request.requestBranch) ||
              getFallbackBranchByCategorySlug(request.category?.slug);
            const sector =
              getSectorById(request.requestSector) ||
              getSectorById(branch?.sectorId);

            if (!branch && !sector) return null;

            return (
              <PanelCard>
                <div className="flex flex-wrap gap-2">
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
              </PanelCard>
            );
          })()}

          <PanelCard>
            <h1 className="text-2xl font-bold">{request.title}</h1>
            <p className="mt-3 whitespace-pre-wrap text-muted">{request.description}</p>
          </PanelCard>

          <PanelCard>
            <h2 className="mb-4 text-lg font-semibold">{t("detailsTitle")}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted">{t("category")}</p>
                <p className="font-medium">
                  {locale.startsWith("de")
                    ? request.category?.nameDe || "-"
                    : request.category?.nameEn || "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">{t("status")}</p>
                <p className="font-medium">{request.status}</p>
              </div>
              <div>
                <p className="text-sm text-muted">{t("location")}</p>
                <p className="font-medium">{`${request.postalCode} ${request.city}`}</p>
              </div>
              <div>
                <p className="text-sm text-muted">{t("address")}</p>
                <p className="font-medium">{request.address || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted">{t("budget")}</p>
                <p className="font-medium">
                  {request.budgetMin !== undefined || request.budgetMax !== undefined
                    ? `€${request.budgetMin ?? "-"} - €${request.budgetMax ?? "-"}`
                    : t("budgetFlexible")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">{t("createdAt")}</p>
                <p className="font-medium">{new Date(request.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted">{t("preferredDate")}</p>
                <p className="font-medium">
                  {request.preferredDate
                    ? new Date(request.preferredDate).toLocaleDateString()
                    : t("notSpecified")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted">{t("quotes")}</p>
                <p className="font-medium">{request._count?.quotes ?? 0}</p>
              </div>
            </div>
          </PanelCard>
        </div>
      )}
    </ProviderSubpageShell>
  );
}
