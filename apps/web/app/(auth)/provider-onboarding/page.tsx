"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SimpleHeader } from "@/components";
import { useAuth } from "@/contexts";
import { useTranslations, useLocale } from "next-intl";
import { getCategories, type Category } from "@/lib/api";

type ProviderOnboardingData = {
  categories: string[];
  firstName: string;
  lastName: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  serviceRadius: string;
  phone: string;
  email: string;
  companyName: string;
  description: string;
  experienceYears: string;
  priceMin: string;
  priceMax: string;
  website: string;
  password: string;
  confirmPassword: string;
  gdprConsent: boolean;
};

export default function ProviderOnboardingPage() {
  const t = useTranslations("providerOnboarding");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState<ProviderOnboardingData>({
    categories: [],
    firstName: "",
    lastName: "",
    streetAddress: "",
    postalCode: "",
    city: "",
    serviceRadius: "25",
    phone: "",
    email: "",
    companyName: "",
    description: "",
    experienceYears: "",
    priceMin: "",
    priceMax: "",
    website: "",
    password: "",
    confirmPassword: "",
    gdprConsent: false,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const steps = [
    { id: "category", title: t("steps.category") },
    { id: "name", title: t("steps.name") },
    { id: "address", title: t("steps.address") },
    { id: "contact", title: t("steps.contact") },
    { id: "profile", title: t("steps.profile") },
  ];

  useEffect(() => {
    async function fetchCategories() {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      } finally {
        setLoadingCategories(false);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const firstName = searchParams.get("firstName");
    const lastName = searchParams.get("lastName");
    const email = searchParams.get("email");

    if (firstName || lastName || email) {
      setFormData((prev) => ({
        ...prev,
        firstName: firstName ?? prev.firstName,
        lastName: lastName ?? prev.lastName,
        email: email ?? prev.email,
      }));
    }
  }, [searchParams]);

  const progressPercent = useMemo(
    () => Math.round(((currentStep + 1) / steps.length) * 100),
    [currentStep]
  );

  const validateStep = () => {
    setError("");
    if (currentStep === 0 && formData.categories.length === 0) {
      setError(t("errors.selectCategory"));
      return false;
    }
    if (currentStep === 1 && (!formData.firstName || !formData.lastName)) {
      setError(t("errors.enterName"));
      return false;
    }
    if (
      currentStep === 2 &&
      (!formData.streetAddress || !formData.postalCode || !formData.city)
    ) {
      setError(t("errors.enterAddress"));
      return false;
    }
    if (
      currentStep === 3 &&
      (!formData.phone || !formData.email)
    ) {
      setError(t("errors.enterContact"));
      return false;
    }
    if (currentStep === 4) {
      if (!formData.companyName || !formData.description) {
        setError(t("errors.enterProfile"));
        return false;
      }
      if (formData.password.length < 8) {
        setError(t("errors.passwordLength"));
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError(t("errors.passwordMatch"));
        return false;
      }
      if (!formData.gdprConsent) {
        setError(t("errors.acceptTerms"));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError("");
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;
    setIsSubmitting(true);
    try {
      await register({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        userType: "provider",
        gdprConsent: formData.gdprConsent,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || t("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryName = (category: Category) => {
    return locale === 'de' ? category.nameDe : category.nameEn;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <SimpleHeader />
      <div className="w-full max-w-3xl">
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mb-8">
            <Link href="/" className="text-2xl font-bold text-primary">
              Armut
            </Link>
            <h1 className="mt-4 text-2xl font-bold text-foreground">
              {t("title")}
            </h1>
            <p className="mt-2 text-muted">
              {t("subtitle")}
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-border">
              <div
                className="h-2 rounded-full bg-secondary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={`rounded-full px-3 py-1 ${
                    index === currentStep
                      ? "bg-secondary/10 text-secondary"
                      : "bg-background"
                  }`}
                >
                  {step.title}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {currentStep === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("labels.serviceCategories")}
                  </label>
                  {loadingCategories ? (
                    <div className="text-sm text-muted">Loading categories...</div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {categories.map((category) => (
                        <label
                          key={category.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 hover:border-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={formData.categories.includes(category.slug)}
                            onChange={(e) => {
                              setFormData((prev) => ({
                                ...prev,
                                categories: e.target.checked
                                  ? [...prev.categories, category.slug]
                                  : prev.categories.filter((c) => c !== category.slug),
                              }));
                            }}
                            className="rounded border-border"
                          />
                          <span>{category.icon} {getCategoryName(category)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("labels.experience")}
                    </label>
                    <input
                      type="number"
                      value={formData.experienceYears}
                      onChange={(e) =>
                        setFormData({ ...formData, experienceYears: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("labels.priceMin")}
                    </label>
                    <input
                      type="number"
                      value={formData.priceMin}
                      onChange={(e) =>
                        setFormData({ ...formData, priceMin: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                       {t("labels.priceMax")}
                    </label>
                    <input
                      type="number"
                      value={formData.priceMax}
                      onChange={(e) =>
                        setFormData({ ...formData, priceMax: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("labels.firstName")}
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                     {t("labels.lastName")}
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("labels.streetAddress")}
                  </label>
                  <input
                    type="text"
                    value={formData.streetAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, streetAddress: e.target.value })
                    }
                    className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("labels.postalCode")}
                    </label>
                    <input
                      type="text"
                      value={formData.postalCode}
                      onChange={(e) =>
                        setFormData({ ...formData, postalCode: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("labels.city")}
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("labels.serviceRadius")}
                    </label>
                    <select
                      value={formData.serviceRadius}
                      onChange={(e) =>
                        setFormData({ ...formData, serviceRadius: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    >
                      <option value="10">10 km</option>
                      <option value="25">25 km</option>
                      <option value="50">50 km</option>
                      <option value="100">100 km</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("labels.phone")}
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("labels.email")}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("labels.companyName")}
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData({ ...formData, companyName: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("labels.website")}
                    </label>
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) =>
                        setFormData({ ...formData, website: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    {t("labels.description")}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={4}
                    className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("labels.password")}
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                      minLength={8}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      {t("labels.confirmPassword")}
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmPassword: e.target.value })
                      }
                      className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                      minLength={8}
                      required
                    />
                  </div>
                </div>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.gdprConsent}
                    onChange={(e) =>
                      setFormData({ ...formData, gdprConsent: e.target.checked })
                    }
                    className="mt-1 rounded border-border"
                  />
                  <span className="text-sm text-muted">
                    {t.rich("labels.agreeToTerms", {
                        privacy: (children) => <Link href="/privacy" className="text-secondary hover:underline">{children}</Link>,
                        terms: (children) => <Link href="/terms" className="text-secondary hover:underline">{children}</Link>
                    })}
                  </span>
                </label>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="rounded-lg border border-border px-6 py-3 font-medium hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("buttons.back")}
              </button>
              {currentStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-lg bg-secondary px-6 py-3 font-semibold text-white hover:bg-secondary/90"
                >
                  {t("buttons.continue")}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-secondary px-6 py-3 font-semibold text-white hover:bg-secondary/90 disabled:opacity-50"
                >
                  {isSubmitting ? t("buttons.submitting") : t("buttons.finish")}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
