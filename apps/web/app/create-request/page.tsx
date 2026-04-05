"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertBanner,
  FormInput,
  FormLabel,
  FormSelect,
  FormTextarea,
  Header,
  LanguageToggle,
} from "@/components";
import { useAuth } from "@/contexts";
import {
  getStoredAccessToken,
  requestsApi,
  type CreateRequestData,
  uploadsApi,
  getCategories,
  isApiUnavailableError,
  type Category,
} from "@/lib/api";
import { getCategoryDisplayName } from "@/lib/request-taxonomy";

export default function CreateRequestPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const initialCategory =
    searchParams.get("category") || searchParams.get("kategorie") || "";
  const initialSector =
    searchParams.get("sector") || searchParams.get("requestSector") || "";
  const initialBranch =
    searchParams.get("branch") || searchParams.get("requestBranch") || "";

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(
    initialSector || null,
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    initialBranch || null,
  );
  const [branchSearch, setBranchSearch] = useState("");
  const [formData, setFormData] = useState({
    category: initialCategory,
    title: "",
    description: "",
    postalCode: "",
    city: "",
    address: "",
    preferredDate: "",
    preferredDays: [] as string[],
    preferredTime: "",
    budgetMin: "",
    budgetMax: "",
    images: [] as File[],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weekdayKeys = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ] as const;

  const sectorOptions = useMemo(() => {
    const uniqueParents = new Map<string, NonNullable<Category["parent"]>>();

    categories.forEach((category) => {
      if (category.parent) {
        uniqueParents.set(category.parent.slug, category.parent);
      }
    });

    return Array.from(uniqueParents.values()).sort((a, b) =>
      (locale.startsWith("de") ? a.nameDe : a.nameEn).localeCompare(
        locale.startsWith("de") ? b.nameDe : b.nameEn,
      ),
    );
  }, [categories, locale]);

  const visibleCategories = useMemo(() => {
    const normalizedQuery = branchSearch.trim().toLowerCase();

    return categories
      .filter((category) => category.parent?.slug === selectedSectorId)
      .filter((category) => {
        if (!normalizedQuery) return true;
        return getCategoryDisplayName(category, locale)
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) =>
        getCategoryDisplayName(a, locale).localeCompare(
          getCategoryDisplayName(b, locale),
        ),
      );
  }, [branchSearch, categories, locale, selectedSectorId]);

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) =>
          category.id === formData.category ||
          category.slug === formData.category,
      ) || null,
    [categories, formData.category],
  );

  const isProviderUser =
    !authLoading && isAuthenticated && user?.userType === "provider";

  useEffect(() => {
    if (isProviderUser) {
      router.replace("/dashboard");
    }
  }, [isProviderUser, router]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (err) {
        console.error("Failed to load categories:", err);
        setCategoriesError(
          isApiUnavailableError(err)
            ? t("createRequest.categoriesUnavailable")
            : t("createRequest.errorCreating"),
        );
      } finally {
        setCategoriesLoading(false);
      }
    };
    loadCategories();
  }, [t]);

  useEffect(() => {
    if (!categories.length) return;

    const resolvedCategory =
      (selectedBranchId
        ? categories.find((category) => category.slug === selectedBranchId) ||
          null
        : null) || selectedCategory;

    if (!resolvedCategory) return;

    if (resolvedCategory.id !== formData.category) {
      setFormData((prev) =>
        prev.category === resolvedCategory.id
          ? prev
          : { ...prev, category: resolvedCategory.id },
      );
    }

    if (selectedBranchId !== resolvedCategory.slug) {
      setSelectedBranchId(resolvedCategory.slug);
    }

    const nextSectorId = resolvedCategory.parent?.slug || null;

    if (selectedSectorId !== nextSectorId) {
      setSelectedSectorId(nextSectorId);
    }
  }, [
    categories,
    formData.category,
    selectedBranchId,
    selectedCategory,
    selectedSectorId,
  ]);

  const getCategoryLabel = (categoryId: string) => {
    const selected = categories.find(
      (cat) => cat.id === categoryId || cat.slug === categoryId,
    );
    if (!selected) return categoryId;
    return getCategoryDisplayName(selected, locale);
  };

  const getSectorLabel = (categoryParent?: Category["parent"] | null) => {
    if (!categoryParent) return "";
    return locale.startsWith("de")
      ? categoryParent.nameDe
      : categoryParent.nameEn;
  };

  const handleSectorSelect = (sectorId: string) => {
    setSelectedSectorId(sectorId);
    setSelectedBranchId(null);
    setBranchSearch("");
    setFormData((prev) => ({ ...prev, category: "" }));
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedSectorId(category.parent?.slug || null);
    setSelectedBranchId(category.slug);
    setFormData((prev) => ({ ...prev, category: category.id }));
    nextStep();
  };

  const buildCreateRequestRedirect = () => {
    const params = new URLSearchParams();

    if (formData.category) {
      params.set("category", formData.category);
    }

    if (selectedSectorId) {
      params.set("sector", selectedSectorId);
    }

    if (selectedBranchId) {
      params.set("branch", selectedBranchId);
    }

    const query = params.toString();
    return query ? `/create-request?${query}` : "/create-request";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (user?.userType === "provider") {
      router.replace("/dashboard");
      return;
    }

    // Check if user is authenticated
    if (!isAuthenticated) {
      router.push(
        `/login?redirect=${encodeURIComponent(buildCreateRequestRedirect())}`,
      );
      return;
    }

    if (isProviderUser) {
      setError(t("createRequest.providerBlockedDescription"));
      return;
    }

    setIsLoading(true);

    try {
      const token = getStoredAccessToken();
      if (!token) {
        throw new Error(t("createRequest.errorNoToken"));
      }

      let imageUrls: string[] = [];
      if (formData.images.length > 0) {
        const uploadedImages = await uploadsApi.uploadRequestImages(
          token,
          formData.images,
        );
        imageUrls = uploadedImages.map((item) => item.url);
      }

      const schedulingNotes = [
        formData.preferredDays.length > 0
          ? `${t("createRequest.dayPreferencesLabel")}: ${formData.preferredDays
              .map((day) => t(`createRequest.days.${day}`))
              .join(", ")}`
          : null,
        formData.preferredTime
          ? `${t("createRequest.timePreferenceLabel")}: ${t(
              `createRequest.${formData.preferredTime}`,
            )}`
          : null,
      ].filter((value): value is string => Boolean(value));

      // Prepare the request data
      const requestData: CreateRequestData = {
        categoryId: formData.category,
        title: formData.title,
        description: schedulingNotes.length
          ? `${formData.description}\n\n${schedulingNotes.join("\n")}`
          : formData.description,
        address: formData.address || `${formData.postalCode} ${formData.city}`,
        city: formData.city,
        postalCode: formData.postalCode,
        lat: 0, // Would normally come from geocoding
        lng: 0, // Would normally come from geocoding
        preferredDate: formData.preferredDate || undefined,
        budgetMin: formData.budgetMin
          ? parseFloat(formData.budgetMin)
          : undefined,
        budgetMax: formData.budgetMax
          ? parseFloat(formData.budgetMax)
          : undefined,
        images: imageUrls,
        requestSector:
          selectedCategory?.parent?.slug || selectedSectorId || undefined,
        requestBranch: selectedCategory?.slug || selectedBranchId || undefined,
      };

      await requestsApi.create(requestData, token);

      // Redirect to my-requests page on success
      router.push("/my-requests");
    } catch (err) {
      console.error("Failed to create request:", err);
      setError(
        err instanceof Error ? err.message : t("createRequest.errorCreating"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  if (authLoading) {
    return null;
  }

  if (isProviderUser) {
    return (
      <div className="min-h-screen bg-background">
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

        <div className="mx-auto max-w-3xl px-4 py-8">
          <AlertBanner variant="warning">
            <p className="font-semibold">
              {t("createRequest.providerBlockedTitle")}
            </p>
            <p>{t("createRequest.providerBlockedDescription")}</p>
            <Link
              href="/dashboard"
              className="mt-3 inline-block font-medium underline"
            >
              {t("createRequest.providerBlockedAction")}
            </Link>
          </AlertBanner>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      {/* Progress Bar */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                    step >= s ? "bg-primary text-white" : "bg-border text-muted"
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

              {categoriesLoading ? (
                <div className="py-12 text-center">
                  <div className="mb-4 text-4xl">⏳</div>
                  <p className="text-muted">
                    {t("createRequest.loadingCategories")}
                  </p>
                </div>
              ) : categoriesError ? (
                <AlertBanner>{categoriesError}</AlertBanner>
              ) : (
                <div className="space-y-5">
                  <div>
                    <FormLabel size="base">
                      {t("createRequest.selectSector")}
                    </FormLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sectorOptions.map((sector) => {
                        const selected = selectedSectorId === sector.slug;
                        return (
                          <button
                            key={sector.id}
                            type="button"
                            onClick={() => handleSectorSelect(sector.slug)}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary"
                            }`}
                          >
                            {getSectorLabel(sector)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedSectorId && (
                    <div>
                      <FormLabel size="base">
                        {t("createRequest.selectBranch")}
                      </FormLabel>
                      <FormInput
                        type="text"
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        placeholder={t("createRequest.branchSearchPlaceholder")}
                        accent="primary"
                      />
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {visibleCategories.map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => handleCategorySelect(category)}
                            className={`rounded-lg border-2 p-3 text-left transition hover:border-primary ${
                              selectedBranchId === category.slug
                                ? "border-primary bg-primary/5"
                                : "border-border"
                            }`}
                          >
                            <span className="mr-2 text-xl">
                              {category.icon}
                            </span>
                            <span className="font-medium">
                              {getCategoryDisplayName(category, locale)}
                            </span>
                          </button>
                        ))}
                      </div>
                      {visibleCategories.length === 0 && (
                        <p className="mt-2 text-sm text-muted">
                          {t("createRequest.noBranchMatch")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                  <FormLabel size="base">
                    {t("createRequest.requestTitle")}
                  </FormLabel>
                  <FormInput
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder={t("createRequest.requestTitlePlaceholder")}
                    accent="primary"
                    required
                  />
                </div>

                <div>
                  <FormLabel size="base">
                    {t("createRequest.description")}
                  </FormLabel>
                  <FormTextarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder={t("createRequest.descriptionPlaceholder")}
                    rows={5}
                    accent="primary"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FormLabel size="base">
                      {t("createRequest.postalCode")}
                    </FormLabel>
                    <FormInput
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) =>
                        setFormData({ ...formData, postalCode: e.target.value })
                      }
                      placeholder={t("createRequest.postalCodePlaceholder")}
                      accent="primary"
                      required
                    />
                  </div>
                  <div>
                    <FormLabel size="base">{t("createRequest.city")}</FormLabel>
                    <FormInput
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder={t("createRequest.cityPlaceholder")}
                      accent="primary"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FormLabel size="base">
                      {t("createRequest.preferredDate")}
                    </FormLabel>
                    <FormInput
                      type="date"
                      value={formData.preferredDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          preferredDate: e.target.value,
                        })
                      }
                      accent="primary"
                    />
                  </div>
                  <div>
                    <FormLabel size="base">
                      {t("createRequest.preferredDays")}
                    </FormLabel>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                      {weekdayKeys.map((day) => {
                        const selected = formData.preferredDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                preferredDays: selected
                                  ? prev.preferredDays.filter((d) => d !== day)
                                  : [...prev.preferredDays, day],
                              }))
                            }
                            className={`rounded-md px-2 py-1 text-left text-sm ${
                              selected
                                ? "bg-primary text-white"
                                : "bg-background text-foreground hover:bg-primary/10"
                            }`}
                          >
                            {t(`createRequest.days.${day}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <FormLabel size="base">
                      {t("createRequest.preferredTime")}
                    </FormLabel>
                    <FormSelect
                      value={formData.preferredTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          preferredTime: e.target.value,
                        })
                      }
                      accent="primary"
                    >
                      <option value="">{t("createRequest.flexible")}</option>
                      <option value="morning">
                        {t("createRequest.morning")}
                      </option>
                      <option value="afternoon">
                        {t("createRequest.afternoon")}
                      </option>
                      <option value="evening">
                        {t("createRequest.evening")}
                      </option>
                    </FormSelect>
                  </div>
                </div>

                <div>
                  <FormLabel size="base">{t("createRequest.budget")}</FormLabel>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <FormInput
                        type="number"
                        value={formData.budgetMin}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            budgetMin: e.target.value,
                          })
                        }
                        placeholder={t("createRequest.budgetMin")}
                        accent="primary"
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                        €
                      </span>
                    </div>
                    <div className="relative">
                      <FormInput
                        type="number"
                        value={formData.budgetMax}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            budgetMax: e.target.value,
                          })
                        }
                        placeholder={t("createRequest.budgetMax")}
                        accent="primary"
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                        €
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <FormLabel size="base">
                    {t("createRequest.addPhotos")}
                  </FormLabel>
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
                      {formData.images.length}{" "}
                      {t("createRequest.filesSelected")}
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
                  <div className="mb-1 text-sm text-muted">
                    {t("createRequest.categoryLabel")}
                  </div>
                  <div className="font-medium">
                    {selectedCategory?.icon}{" "}
                    {getCategoryLabel(formData.category)}
                  </div>
                  {selectedCategory?.parent && (
                    <div className="mt-1 text-sm text-muted">
                      {getSectorLabel(selectedCategory.parent)}
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-background p-4">
                  <div className="mb-1 text-sm text-muted">
                    {t("createRequest.titleLabel")}
                  </div>
                  <div className="font-medium">{formData.title}</div>
                </div>

                <div className="rounded-lg bg-background p-4">
                  <div className="mb-1 text-sm text-muted">
                    {t("createRequest.descriptionLabel")}
                  </div>
                  <div className="whitespace-pre-wrap">
                    {formData.description}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg bg-background p-4">
                    <div className="mb-1 text-sm text-muted">
                      {t("createRequest.locationLabel")}
                    </div>
                    <div className="font-medium">
                      {formData.postalCode} {formData.city}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background p-4">
                    <div className="mb-1 text-sm text-muted">
                      {t("createRequest.appointmentLabel")}
                    </div>
                    <div className="space-y-1 font-medium">
                      <div>
                        {formData.preferredDate
                          ? new Date(formData.preferredDate).toLocaleDateString(
                              locale,
                            )
                          : t("createRequest.flexible")}
                      </div>
                      {formData.preferredDays.length > 0 ? (
                        <div className="text-sm text-muted">
                          {t("createRequest.dayPreferencesLabel")}:{" "}
                          {formData.preferredDays
                            .map((day) => t(`createRequest.days.${day}`))
                            .join(", ")}
                        </div>
                      ) : null}
                      {formData.preferredTime ? (
                        <div className="text-sm text-muted">
                          {t("createRequest.timePreferenceLabel")}:{" "}
                          {t(`createRequest.${formData.preferredTime}`)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {(formData.budgetMin || formData.budgetMax) && (
                  <div className="rounded-lg bg-background p-4">
                    <div className="mb-1 text-sm text-muted">
                      {t("createRequest.budgetLabel")}
                    </div>
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
                    <div className="font-medium">
                      {t("createRequest.nextStepsTitle")}
                    </div>
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
                  {isLoading
                    ? t("createRequest.submitting")
                    : t("createRequest.submitRequest")}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
