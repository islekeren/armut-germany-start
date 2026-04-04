"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts";
import { FormInput, FormLabel, FormTextarea } from "@/components";
import { getStoredAccessToken, requestsApi } from "@/lib/api";

interface RequestOfferModalProps {
  categoryId?: string;
  providerName?: string;
  serviceName?: string;
  defaultPostalCode?: string;
  defaultCity?: string;
}

export function RequestOfferModal({
  categoryId,
  providerName,
  serviceName,
  defaultPostalCode = "",
  defaultCity = "",
}: RequestOfferModalProps) {
  const t = useTranslations("providerPublicProfile.offerModal");
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    postalCode: defaultPostalCode,
    city: defaultCity,
    budgetMin: "",
    budgetMax: "",
  });

  if (isAuthenticated && user?.userType !== "customer") {
    return null;
  }

  const handleOpen = () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!categoryId) {
      setError(t("missingCategory"));
      return;
    }

    if (formData.description.trim().length < 20) {
      setError(t("descriptionTooShort"));
      return;
    }

    if (
      formData.budgetMin &&
      formData.budgetMax &&
      Number(formData.budgetMin) > Number(formData.budgetMax)
    ) {
      setError(t("budgetRangeError"));
      return;
    }

    try {
      setLoading(true);
      const token = getStoredAccessToken();
      if (!token) {
        router.push(`/login?redirect=${encodeURIComponent(pathname || "/")}`);
        return;
      }

      await requestsApi.create(
        {
          categoryId,
          title: formData.title,
          description: formData.description,
          postalCode: formData.postalCode,
          city: formData.city,
          address: `${formData.postalCode} ${formData.city}`,
          lat: 0,
          lng: 0,
          budgetMin: formData.budgetMin ? Number(formData.budgetMin) : undefined,
          budgetMax: formData.budgetMax ? Number(formData.budgetMax) : undefined,
        },
        token,
      );

      setSuccess(true);
    } catch (submitError) {
      console.error("Failed to submit offer request", submitError);
      setError(t("submitError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg bg-secondary px-5 py-2.5 font-semibold text-white hover:bg-secondary/90"
      >
        {t("trigger")}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t("title")}</h2>
                <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {t("close")}
              </button>
            </div>

            {success ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  {t("submitSuccess")}
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-border px-4 py-2"
                  >
                    {t("done")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push("/my-requests");
                    }}
                    className="rounded-lg bg-primary px-4 py-2 text-white"
                  >
                    {t("goToRequests")}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-semibold text-slate-800">{t("serviceContext")}</div>
                  <div className="mt-1 text-slate-700">
                    {providerName || "-"}
                    {serviceName ? ` • ${serviceName}` : ""}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                    {t("sectionDetails")}
                  </h3>
                  <FormLabel className="text-slate-800">{t("titleLabel")} *</FormLabel>
                  <FormInput
                    className="bg-white text-slate-900 placeholder:text-slate-400"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t("titlePlaceholder")}
                    required
                  />
                </div>

                <div>
                  <FormLabel className="text-slate-800">{t("descriptionLabel")} *</FormLabel>
                  <FormTextarea
                    className="bg-white text-slate-900 placeholder:text-slate-400"
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t("descriptionPlaceholder")}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-600">{t("descriptionHint")}</p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                    {t("sectionLocation")}
                  </h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FormLabel className="text-slate-800">{t("postalCodeLabel")} *</FormLabel>
                    <FormInput
                      className="bg-white text-slate-900 placeholder:text-slate-400"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder={t("postalCodePlaceholder")}
                      required
                    />
                  </div>
                  <div>
                    <FormLabel className="text-slate-800">{t("cityLabel")} *</FormLabel>
                    <FormInput
                      className="bg-white text-slate-900 placeholder:text-slate-400"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder={t("cityPlaceholder")}
                      required
                    />
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                    {t("sectionBudget")}
                  </h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FormLabel className="text-slate-800">{t("budgetMinLabel")}</FormLabel>
                    <FormInput
                      className="bg-white text-slate-900 placeholder:text-slate-400"
                      type="number"
                      value={formData.budgetMin}
                      onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <FormLabel className="text-slate-800">{t("budgetMaxLabel")}</FormLabel>
                    <FormInput
                      className="bg-white text-slate-900 placeholder:text-slate-400"
                      type="number"
                      value={formData.budgetMax}
                      onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                      placeholder="1000"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-600">{t("budgetHint")}</p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-primary px-4 py-2 font-medium text-white disabled:opacity-60"
                  >
                    {loading ? t("sending") : t("submit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
