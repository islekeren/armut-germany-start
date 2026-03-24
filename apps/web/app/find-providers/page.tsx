"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertBanner, Header } from "@/components";
import { getCategories, providersApi, type Category, type PublicProvider } from "@/lib/api";

export default function FindProvidersPage() {
  const t = useTranslations("findProviders");
  const locale = useLocale();
  const isGerman = locale.startsWith("de");

  const [categories, setCategories] = useState<Category[]>([]);
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [minRating, setMinRating] = useState("");
  const [city, setCity] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [categoriesData, providersData] = await Promise.all([
          getCategories(),
          providersApi.getAll({
            categoryId: categoryId || undefined,
            minRating: minRating ? Number(minRating) : undefined,
            limit: 100,
          }),
        ]);
        setCategories(categoriesData);
        setProviders(providersData.data);
      } catch (err) {
        console.error("Failed to load providers", err);
        setError(t("loadError"));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [categoryId, minRating, t]);

  const filteredProviders = useMemo(() => {
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;
    const cityQuery = city.trim().toLowerCase();

    return providers.filter((provider) => {
      if (cityQuery) {
        const providerCity = provider.profile?.city?.toLowerCase() || "";
        if (!providerCity.includes(cityQuery)) return false;
      }

      if (min !== null || max !== null) {
        const prices = provider.services
          .flatMap((service) => [service.priceMin, service.priceMax])
          .filter((value): value is number => typeof value === "number");

        if (!prices.length) return false;
        const serviceMin = Math.min(...prices);
        const serviceMax = Math.max(...prices);

        if (min !== null && serviceMax < min) return false;
        if (max !== null && serviceMin > max) return false;
      }

      return true;
    });
  }, [providers, city, priceMin, priceMax]);

  const formatPrice = (provider: PublicProvider) => {
    const prices = provider.services
      .flatMap((service) => [service.priceMin, service.priceMax])
      .filter((value): value is number => typeof value === "number");

    if (!prices.length) return t("priceOnRequest");

    const min = Math.min(...prices);
    const max = Math.max(...prices);

    if (min === max) return `€${min}`;
    return `€${min} - €${max}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="border-b bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-muted">{t("subtitle")}</p>
        </div>
      </section>

      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {error && <AlertBanner className="mb-6">{error}</AlertBanner>}

          <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">{t("filters.title")}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm text-muted">{t("filters.category")}</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-primary focus:outline-none"
                >
                  <option value="">{t("filters.allCategories")}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {isGerman ? category.nameDe : category.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted">{t("filters.minRating")}</label>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-primary focus:outline-none"
                >
                  <option value="">{t("filters.allRatings")}</option>
                  <option value="4">4+</option>
                  <option value="4.5">4.5+</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted">{t("filters.city")}</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("filters.cityPlaceholder")}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted">{t("filters.priceMin")}</label>
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted">{t("filters.priceMax")}</label>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="1000"
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl bg-white p-8 text-center text-muted shadow-sm">{t("loading")}</div>
          ) : filteredProviders.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-muted shadow-sm">{t("noProviders")}</div>
          ) : (
            <div className="grid gap-4">
              {filteredProviders.map((provider) => {
                const providerName =
                  provider.companyName ||
                  `${provider.user.firstName} ${provider.user.lastName}`.trim();

                return (
                  <article key={provider.id} className="rounded-xl bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">{providerName}</h3>
                        <p className="mt-1 text-sm text-muted">
                          {provider.profile?.city || t("cityUnknown")}
                        </p>
                        <p className="mt-2 text-sm text-muted">{provider.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                          <span>⭐ {provider.ratingAvg.toFixed(1)}</span>
                          <span>({provider.totalReviews})</span>
                          <span>{formatPrice(provider)}</span>
                        </div>
                      </div>
                      <Link
                        href={`/providers/${provider.id}`}
                        className="inline-flex rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
                      >
                        {t("viewProfile")}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
