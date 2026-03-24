"use client";

import { useState, useEffect } from "react";
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

type RequestSector = {
  id: string;
  labelEn: string;
  labelDe: string;
  colorClass: string;
};

type RequestBranch = {
  id: string;
  sectorId: RequestSector["id"];
  labelEn: string;
  labelDe: string;
  categorySlug: string;
};

const REQUEST_SECTORS: RequestSector[] = [
  { id: "home-repair", labelEn: "Home Repair & Renovation", labelDe: "Hausreparatur & Renovierung", colorClass: "bg-emerald-100 text-emerald-800" },
  { id: "cleaning-care", labelEn: "Cleaning & Home Care", labelDe: "Reinigung & Haushaltspflege", colorClass: "bg-blue-100 text-blue-800" },
  { id: "education-hobby", labelEn: "Education, Courses & Hobby", labelDe: "Bildung, Kurse & Hobby", colorClass: "bg-violet-100 text-violet-800" },
  { id: "art-events", labelEn: "Art, Photo & Events", labelDe: "Kunst, Foto & Events", colorClass: "bg-amber-100 text-amber-800" },
  { id: "health-beauty", labelEn: "Health & Beauty", labelDe: "Gesundheit & Beauty", colorClass: "bg-rose-100 text-rose-800" },
  { id: "digital-tech", labelEn: "Digital & Technology", labelDe: "Digital & Technologie", colorClass: "bg-lime-100 text-lime-800" },
  { id: "logistics", labelEn: "Transport & Logistics", labelDe: "Transport & Logistik", colorClass: "bg-pink-100 text-pink-800" },
  { id: "pet-care", labelEn: "Pet Services", labelDe: "Haustierdienste", colorClass: "bg-orange-100 text-orange-800" },
];

const REQUEST_BRANCHES: RequestBranch[] = [
  { id: "electrician", sectorId: "home-repair", labelEn: "Electrician", labelDe: "Elektriker", categorySlug: "electrician" },
  { id: "plumber", sectorId: "home-repair", labelEn: "Plumber", labelDe: "Installateur", categorySlug: "plumber" },
  { id: "painter", sectorId: "home-repair", labelEn: "Painter", labelDe: "Maler", categorySlug: "painter" },
  { id: "locksmith", sectorId: "home-repair", labelEn: "Locksmith", labelDe: "Schluesseldienst", categorySlug: "locksmith" },
  { id: "renovation", sectorId: "home-repair", labelEn: "Renovation", labelDe: "Renovierung", categorySlug: "renovation" },

  { id: "home-cleaning", sectorId: "cleaning-care", labelEn: "Home Cleaning", labelDe: "Hausreinigung", categorySlug: "cleaning" },
  { id: "office-cleaning", sectorId: "cleaning-care", labelEn: "Office Cleaning", labelDe: "Bueroreinigung", categorySlug: "cleaning" },
  { id: "deep-cleaning", sectorId: "cleaning-care", labelEn: "Deep Cleaning", labelDe: "Grundreinigung", categorySlug: "cleaning" },
  { id: "garden-maintenance", sectorId: "cleaning-care", labelEn: "Garden Maintenance", labelDe: "Gartenpflege", categorySlug: "garden" },

  { id: "math", sectorId: "education-hobby", labelEn: "Math Lessons", labelDe: "Matheunterricht", categorySlug: "tutoring" },
  { id: "english", sectorId: "education-hobby", labelEn: "English Lessons", labelDe: "Englischunterricht", categorySlug: "tutoring" },
  { id: "music", sectorId: "education-hobby", labelEn: "Music Lessons", labelDe: "Musikunterricht", categorySlug: "tutoring" },

  { id: "wedding-photo", sectorId: "art-events", labelEn: "Wedding Photographer", labelDe: "Hochzeitsfotograf", categorySlug: "photography" },
  { id: "event-photo", sectorId: "art-events", labelEn: "Event Photographer", labelDe: "Eventfotograf", categorySlug: "photography" },
  { id: "video", sectorId: "art-events", labelEn: "Video Shooting", labelDe: "Videoaufnahme", categorySlug: "photography" },

  { id: "beauty", sectorId: "health-beauty", labelEn: "Beauty Service", labelDe: "Beautydienst", categorySlug: "cleaning" },
  { id: "hair", sectorId: "health-beauty", labelEn: "Hairdresser (Home Visit)", labelDe: "Friseur (Hausbesuch)", categorySlug: "cleaning" },

  { id: "computer", sectorId: "digital-tech", labelEn: "Computer Help", labelDe: "Computerhilfe", categorySlug: "computerHelp" },
  { id: "software", sectorId: "digital-tech", labelEn: "Software & IT Support", labelDe: "Software & IT Support", categorySlug: "computerHelp" },
  { id: "website", sectorId: "digital-tech", labelEn: "Website Development", labelDe: "Webentwicklung", categorySlug: "computerHelp" },

  { id: "moving", sectorId: "logistics", labelEn: "Home Moving", labelDe: "Umzug", categorySlug: "moving" },
  { id: "furniture", sectorId: "logistics", labelEn: "Furniture Assembly", labelDe: "Moebelmontage", categorySlug: "moving" },
  { id: "storage", sectorId: "logistics", labelEn: "Storage & Mini Warehouse", labelDe: "Lagerung", categorySlug: "moving" },

  { id: "pet-sitter", sectorId: "pet-care", labelEn: "Pet Sitting", labelDe: "Tiersitting", categorySlug: "petCare" },
  { id: "dog-walk", sectorId: "pet-care", labelEn: "Dog Walking", labelDe: "Hundeservice", categorySlug: "petCare" },
  { id: "pet-groom", sectorId: "pet-care", labelEn: "Pet Grooming", labelDe: "Tierpflege", categorySlug: "petCare" },
];

export default function CreateRequestPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const initialCategory = searchParams.get("category") || searchParams.get("kategorie") || "";

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [branchSearch, setBranchSearch] = useState("");
  const [formData, setFormData] = useState({
    category: initialCategory,
    title: "",
    description: "",
    postalCode: "",
    city: "",
    address: "",
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

  const availableCategorySlugs = new Set(categories.map((item) => item.slug));
  const visibleBranches = REQUEST_BRANCHES.filter(
    (branch) =>
      branch.sectorId === selectedSectorId &&
      availableCategorySlugs.has(branch.categorySlug) &&
      (!branchSearch.trim() ||
        getBranchLabel(branch).toLowerCase().includes(branchSearch.trim().toLowerCase())),
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (isAuthenticated && user?.userType === "provider") {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, router, user?.userType]);

  if (!authLoading && isAuthenticated && user?.userType === "provider") {
    return null;
  }

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
    if (!categories.length || !formData.category) return;

    const selectedCategory = categories.find(
      (cat) => cat.id === formData.category || cat.slug === formData.category,
    );
    if (!selectedCategory) return;

    if (selectedCategory.id !== formData.category) {
      setFormData((prev) => ({ ...prev, category: selectedCategory.id }));
    }

    const mappedBranch = REQUEST_BRANCHES.find(
      (branch) => branch.categorySlug === selectedCategory.slug,
    );
    if (!mappedBranch) return;

    setSelectedSectorId(mappedBranch.sectorId);
    setSelectedBranchId(mappedBranch.id);
  }, [categories, formData.category]);

  const getCategoryLabel = (categoryId: string) => {
    const selected = categories.find((cat) => cat.id === categoryId || cat.slug === categoryId);
    if (!selected) return categoryId;
    return t(`categories.${selected.slug}.name`);
  };

  const getSectorLabel = (sector: RequestSector) =>
    locale === "de" ? sector.labelDe : sector.labelEn;

  const getBranchLabel = (branch: RequestBranch) =>
    locale === "de" ? branch.labelDe : branch.labelEn;
  const selectedBranch = selectedBranchId
    ? REQUEST_BRANCHES.find((branch) => branch.id === selectedBranchId) || null
    : null;

  const handleSectorSelect = (sectorId: string) => {
    setSelectedSectorId(sectorId);
    setSelectedBranchId(null);
    setBranchSearch("");
    setFormData((prev) => ({ ...prev, category: "" }));
  };

  const handleBranchSelect = (branch: RequestBranch) => {
    const category = categories.find((cat) => cat.slug === branch.categorySlug);
    if (!category) return;

    setSelectedBranchId(branch.id);
    setFormData((prev) => ({ ...prev, category: category.id }));
    nextStep();
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
      router.push(`/login?redirect=/create-request?category=${formData.category}`);
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
          formData.images
        );
        imageUrls = uploadedImages.map((item) => item.url);
      }

      // Prepare the request data
      const requestData: CreateRequestData = {
        categoryId: formData.category,
        title: formData.title,
        description:
          formData.preferredDays.length > 0
            ? `${formData.description}\n\nPreferred days: ${formData.preferredDays
                .map((day) => t(`createRequest.days.${day}`))
                .join(", ")}`
            : formData.description,
        address: formData.address || `${formData.postalCode} ${formData.city}`,
        city: formData.city,
        postalCode: formData.postalCode,
        lat: 0, // Would normally come from geocoding
        lng: 0, // Would normally come from geocoding
        budgetMin: formData.budgetMin ? parseFloat(formData.budgetMin) : undefined,
        budgetMax: formData.budgetMax ? parseFloat(formData.budgetMax) : undefined,
        images: imageUrls,
      };

      await requestsApi.create(requestData, token);
      
      // Redirect to my-requests page on success
      router.push("/my-requests");
    } catch (err) {
      console.error("Failed to create request:", err);
      setError(
        err instanceof Error ? err.message : t("createRequest.errorCreating")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 3));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

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

              {categoriesLoading ? (
                <div className="py-12 text-center">
                  <div className="mb-4 text-4xl">⏳</div>
                  <p className="text-muted">{t("createRequest.loadingCategories")}</p>
                </div>
              ) : categoriesError ? (
                <AlertBanner>{categoriesError}</AlertBanner>
              ) : (
                <div className="space-y-5">
                  <div>
                    <FormLabel size="base">{t("createRequest.selectSector")}</FormLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {REQUEST_SECTORS.map((sector) => {
                        const selected = selectedSectorId === sector.id;
                        return (
                          <button
                            key={sector.id}
                            type="button"
                            onClick={() => handleSectorSelect(sector.id)}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary"
                            }`}
                          >
                            <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${sector.colorClass}`} />
                            {getSectorLabel(sector)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedSectorId && (
                    <div>
                      <FormLabel size="base">{t("createRequest.selectBranch")}</FormLabel>
                      <FormInput
                        type="text"
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        placeholder={t("createRequest.branchSearchPlaceholder")}
                        accent="primary"
                      />
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {visibleBranches.map((branch) => (
                          <button
                            key={branch.id}
                            type="button"
                            onClick={() => handleBranchSelect(branch)}
                            className={`rounded-lg border-2 p-3 text-left transition hover:border-primary ${
                              selectedBranchId === branch.id
                                ? "border-primary bg-primary/5"
                                : "border-border"
                            }`}
                          >
                            <span className="font-medium">{getBranchLabel(branch)}</span>
                          </button>
                        ))}
                      </div>
                      {visibleBranches.length === 0 && (
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
                  <FormLabel size="base">{t("createRequest.requestTitle")}</FormLabel>
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
                  <FormLabel size="base">{t("createRequest.description")}</FormLabel>
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
                    <FormLabel size="base">{t("createRequest.postalCode")}</FormLabel>
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
                    <FormLabel size="base">{t("createRequest.preferredDays")}</FormLabel>
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
                    <FormLabel size="base">{t("createRequest.preferredTime")}</FormLabel>
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
                      <option value="morning">{t("createRequest.morning")}</option>
                      <option value="afternoon">{t("createRequest.afternoon")}</option>
                      <option value="evening">{t("createRequest.evening")}</option>
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
                        accent="primary" className="pr-8"
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
                        accent="primary" className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                        €
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <FormLabel size="base">{t("createRequest.addPhotos")}</FormLabel>
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
                    {categories.find((c) => c.id === formData.category)?.icon}{" "}
                    {getCategoryLabel(formData.category)}
                  </div>
                  {selectedBranchId && (
                    <div className="mt-1 text-sm text-muted">
                      {selectedBranch ? getBranchLabel(selectedBranch) : ""}
                    </div>
                  )}
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
                      {formData.preferredDays.length
                        ? formData.preferredDays
                            .map((day) => t(`createRequest.days.${day}`))
                            .join(", ")
                        : t("createRequest.flexible")}
                      {formData.preferredTime
                        ? `, ${t(`createRequest.${formData.preferredTime}`)}`
                        : ""}
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
