"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageToggle } from "@/components";
import { useAuth } from "@/contexts";
import { requestsApi, type CreateRequestData } from "@/lib/api";

const categoryKeys = [
  { id: "reinigung", key: "cleaning", icon: "🧹" },
  { id: "umzug", key: "moving", icon: "📦" },
  { id: "renovierung", key: "renovation", icon: "🔨" },
  { id: "garten", key: "garden", icon: "🌳" },
  { id: "elektriker", key: "electrician", icon: "⚡" },
  { id: "klempner", key: "plumber", icon: "🔧" },
  { id: "maler", key: "painter", icon: "🎨" },
  { id: "schlosser", key: "locksmith", icon: "🔐" },
  { id: "nachhilfe", key: "tutoring", icon: "📚" },
  { id: "fotografie", key: "photography", icon: "📷" },
  { id: "computerhilfe", key: "computerHelp", icon: "💻" },
  { id: "tierpflege", key: "petCare", icon: "🐕" },
];

export default function CreateRequestPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const initialCategory = searchParams.get("kategorie") || "";

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    category: initialCategory,
    title: "",
    description: "",
    postalCode: "",
    city: "",
    address: "",
    preferredDate: "",
    preferredTime: "",
    budgetMin: "",
    budgetMax: "",
    images: [] as File[],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("armut_access_token");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Check if user is authenticated
    if (!isAuthenticated) {
      router.push(`/login?redirect=/create-request?kategorie=${formData.category}`);
      return;
    }

    setIsLoading(true);

    try {
      const token = getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Prepare the request data
      const requestData: CreateRequestData = {
        categoryId: formData.category,
        title: formData.title,
        description: formData.description,
        address: formData.address || `${formData.postalCode} ${formData.city}`,
        city: formData.city,
        postalCode: formData.postalCode,
        lat: 0, // Would normally come from geocoding
        lng: 0, // Would normally come from geocoding
        preferredDate: formData.preferredDate || undefined,
        budgetMin: formData.budgetMin ? parseFloat(formData.budgetMin) : undefined,
        budgetMax: formData.budgetMax ? parseFloat(formData.budgetMax) : undefined,
        images: [], // Would normally be uploaded URLs
      };

      // TODO: Handle image uploads here if needed
      // For now, we skip image upload as it would require a separate upload endpoint

      await requestsApi.create(requestData, token);
      
      // Redirect to my-requests page on success
      router.push("/my-requests");
    } catch (err) {
      console.error("Failed to create request:", err);
      setError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">Armut</span>
              <span className="text-sm text-muted">Germany</span>
            </Link>
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                    step >= s
                      ? "bg-primary text-white"
                      : "bg-border text-muted"
                  }`}
                >
                  {s}
                </div>
                <span className="ml-2 hidden sm:block">
                  {s === 1 && t("createRequest.step1")}
                  {s === 2 && t("createRequest.step2")}
                  {s === 3 && t("createRequest.step3")}
                </span>
                {s < 3 && (
                  <div
                    className={`mx-4 h-1 w-16 sm:w-24 ${
                      step > s ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        <form onSubmit={handleSubmit}>
          {/* Step 1: Category Selection */}
          {step === 1 && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h1 className="mb-2 text-2xl font-bold">
                {t("createRequest.whatDoYouNeed")}
              </h1>
              <p className="mb-6 text-muted">
                {t("createRequest.selectCategory")}
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categoryKeys.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, category: cat.id });
                      nextStep();
                    }}
                    className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition hover:border-primary ${
                      formData.category === cat.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="font-medium">{t(`categories.${cat.key}.name`)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Request Details */}
          {step === 2 && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h1 className="mb-2 text-2xl font-bold">
                {t("createRequest.describeYourNeed")}
              </h1>
              <p className="mb-6 text-muted">
                {t("createRequest.moreDetailsBetterOffers")}
              </p>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 block font-medium">
                    {t("createRequest.requestTitle")}
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder={t("createRequest.requestTitlePlaceholder")}
                    className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    {t("createRequest.description")}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder={t("createRequest.descriptionPlaceholder")}
                    rows={5}
                    className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-medium">
                      {t("createRequest.postalCode")}
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) =>
                        setFormData({ ...formData, postalCode: e.target.value })
                      }
                      placeholder={t("createRequest.postalCodePlaceholder")}
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block font-medium">{t("createRequest.city")}</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder={t("createRequest.cityPlaceholder")}
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-medium">
                      {t("createRequest.preferredDate")}
                    </label>
                    <input
                      type="date"
                      value={formData.preferredDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          preferredDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block font-medium">
                      {t("createRequest.preferredTime")}
                    </label>
                    <select
                      value={formData.preferredTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          preferredTime: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-primary focus:outline-none"
                    >
                      <option value="">{t("createRequest.flexible")}</option>
                      <option value="morning">{t("createRequest.morning")}</option>
                      <option value="afternoon">{t("createRequest.afternoon")}</option>
                      <option value="evening">{t("createRequest.evening")}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    {t("createRequest.budget")}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.budgetMin}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            budgetMin: e.target.value,
                          })
                        }
                        placeholder={t("createRequest.budgetMin")}
                        className="w-full rounded-lg border border-border px-4 py-3 pr-8 focus:border-primary focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                        €
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.budgetMax}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            budgetMax: e.target.value,
                          })
                        }
                        placeholder={t("createRequest.budgetMax")}
                        className="w-full rounded-lg border border-border px-4 py-3 pr-8 focus:border-primary focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                        €
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block font-medium">
                    {t("createRequest.addPhotos")}
                  </label>
                  <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      id="images"
                      onChange={(e) => {
                        if (e.target.files) {
                          setFormData({
                            ...formData,
                            images: Array.from(e.target.files),
                          });
                        }
                      }}
                    />
                    <label
                      htmlFor="images"
                      className="cursor-pointer text-muted"
                    >
                      <div className="mb-2 text-4xl">📷</div>
                      <div>{t("createRequest.uploadPhotos")}</div>
                      <div className="mt-1 text-sm">
                        {t("createRequest.dragPhotos")}
                      </div>
                    </label>
                  </div>
                  {formData.images.length > 0 && (
                    <p className="mt-2 text-sm text-muted">
                      {formData.images.length} {t("createRequest.filesSelected")}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  className="rounded-lg border border-border px-6 py-3 font-medium hover:bg-background"
                >
                  {t("createRequest.back")}
                </button>
                <button
                  type="button"
                  onClick={nextStep}
                  className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark"
                >
                  {t("createRequest.next")}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h1 className="mb-2 text-2xl font-bold">
                {t("createRequest.reviewTitle")}
              </h1>
              <p className="mb-6 text-muted">
                {t("createRequest.reviewSubtitle")}
              </p>

              <div className="space-y-4">
                <div className="rounded-lg bg-background p-4">
                  <div className="mb-1 text-sm text-muted">{t("createRequest.categoryLabel")}</div>
                  <div className="font-medium">
                    {categoryKeys.find((c) => c.id === formData.category)?.icon}{" "}
                    {categoryKeys.find((c) => c.id === formData.category)?.key}
                  </div>
                </div>

                <div className="rounded-lg bg-background p-4">
                  <div className="mb-1 text-sm text-muted">{t("createRequest.titleLabel")}</div>
                  <div className="font-medium">{formData.title}</div>
                </div>

                <div className="rounded-lg bg-background p-4">
                  <div className="mb-1 text-sm text-muted">{t("createRequest.descriptionLabel")}</div>
                  <div className="whitespace-pre-wrap">{formData.description}</div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-background p-4">
                    <div className="mb-1 text-sm text-muted">{t("createRequest.locationLabel")}</div>
                    <div className="font-medium">
                      {formData.postalCode} {formData.city}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background p-4">
                    <div className="mb-1 text-sm text-muted">{t("createRequest.appointmentLabel")}</div>
                    <div className="font-medium">
                      {formData.preferredDate || t("createRequest.flexible")}
                      {formData.preferredTime && `, ${formData.preferredTime}`}
                    </div>
                  </div>
                </div>

                {(formData.budgetMin || formData.budgetMax) && (
                  <div className="rounded-lg bg-background p-4">
                    <div className="mb-1 text-sm text-muted">{t("createRequest.budgetLabel")}</div>
                    <div className="font-medium">
                      {formData.budgetMin && `${formData.budgetMin}€`}
                      {formData.budgetMin && formData.budgetMax && " - "}
                      {formData.budgetMax && `${formData.budgetMax}€`}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <div className="font-medium">{t("createRequest.nextStepsTitle")}</div>
                    <p className="mt-1 text-sm text-muted">
                      {t("createRequest.nextStepsText")}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                  {error}
                </div>
              )}

              {!isAuthenticated && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700">
                  {t("createRequest.loginRequired")}
                </div>
              )}

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={prevStep}
                  className="rounded-lg border border-border px-6 py-3 font-medium hover:bg-background"
                >
                  {t("createRequest.back")}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-lg bg-secondary px-8 py-3 font-semibold text-white hover:bg-secondary/90 disabled:opacity-50"
                >
                  {isLoading ? t("createRequest.submitting") : t("createRequest.submitRequest")}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
