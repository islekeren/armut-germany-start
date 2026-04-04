import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getCanonicalCategorySlug } from "@repo/shared";
import { AlertBanner, Header, Footer, RequestCtaLink } from "@/components";
import {
  getCategoryBySlug,
  isApiNotFoundError,
  isApiUnavailableError,
  providersApi,
  type Category,
  type ProviderService,
  type PublicProvider,
  type ProvidersResponse,
} from "@/lib/api";

function getServiceForCategory(provider: PublicProvider, categoryId: string) {
  return (
    provider.services.find((service) => service.categoryId === categoryId) ||
    provider.services[0]
  );
}

type SearchParams = Record<string, string | string[] | undefined>;

function buildCategoryPageHref(slug: string, searchParams?: SearchParams) {
  const params = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
      return;
    }

    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `/category/${slug}?${query}` : `/category/${slug}`;
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const t = await getTranslations("categoryPage");
  const tNav = await getTranslations("nav");
  const locale = await getLocale();
  const isGerman = locale.startsWith("de");
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const canonicalSlug = getCanonicalCategorySlug(slug) || slug;
  const pageParam = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams.page[0]
    : resolvedSearchParams?.page;
  const currentPage = Math.max(1, Number(pageParam) || 1);
  const limit = 10;
  let category: Category | null = null;
  let providers: PublicProvider[] = [];
  let meta: ProvidersResponse["meta"] = {
    total: 0,
    page: currentPage,
    limit,
    totalPages: 1,
  };
  let categoryUnavailable = false;
  let providersUnavailable = false;

  if (canonicalSlug !== slug) {
    permanentRedirect(
      buildCategoryPageHref(canonicalSlug, resolvedSearchParams),
    );
  }

  try {
    category = await getCategoryBySlug(canonicalSlug);
  } catch (error) {
    if (isApiNotFoundError(error)) {
      notFound();
    }
    if (isApiUnavailableError(error)) {
      categoryUnavailable = true;
    } else {
      throw error;
    }
  }

  if (!category && !categoryUnavailable) {
    notFound();
  }

  if (category && category.slug !== slug) {
    permanentRedirect(
      buildCategoryPageHref(category.slug, resolvedSearchParams),
    );
  }

  const activeSlug = category?.slug || canonicalSlug;

  const fallbackDisplayName = slug
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
  const displayName = category
    ? isGerman
      ? category.nameDe
      : category.nameEn
    : fallbackDisplayName;
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const ratingFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const formatCurrency = (value: number) => currencyFormatter.format(value);

  const formatPrice = (service?: ProviderService) => {
    if (!service) return t("priceQuote");

    const min = service.priceMin ?? null;
    const max = service.priceMax ?? null;

    if (min === null && max === null) return t("priceQuote");

    if (service.priceType === "hourly") {
      if (min !== null && max !== null && min !== max) {
        return t("priceHourlyRange", {
          min: formatCurrency(min),
          max: formatCurrency(max),
        });
      }
      if (min !== null)
        return t("priceHourlyFrom", { value: formatCurrency(min) });
      if (max !== null)
        return t("priceHourlyUpTo", { value: formatCurrency(max) });
    }

    if (min !== null && max !== null && min !== max) {
      return t("priceRange", {
        min: formatCurrency(min),
        max: formatCurrency(max),
      });
    }
    if (min !== null) return t("priceFrom", { value: formatCurrency(min) });
    if (max !== null) return t("priceUpTo", { value: formatCurrency(max) });

    return t("priceQuote");
  };

  if (category) {
    try {
      const providersResponse = await providersApi.getAll({
        categoryId: category.id,
        page: currentPage,
        limit,
      });
      providers = providersResponse.data;
      meta = providersResponse.meta;
    } catch (error) {
      if (isApiUnavailableError(error)) {
        providersUnavailable = true;
      } else {
        throw error;
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-primary py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{category?.icon ?? "•"}</span>
            <div>
              <nav className="mb-2 text-sm text-white/70">
                <Link href="/" className="hover:text-white">
                  {tNav("home")}
                </Link>
                {" / "}
                <Link href="/categories" className="hover:text-white">
                  {tNav("categories")}
                </Link>
                {" / "}
                <span>{displayName}</span>
              </nav>
              <h1 className="text-3xl font-bold md:text-4xl">{displayName}</h1>
              <p className="mt-2 text-white/90">
                {t("heroSubtitle", { name: displayName })}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Request CTA */}
      <section className="border-b bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div>
              <h2 className="text-lg font-semibold">{t("ctaTitle")}</h2>
              <p className="text-muted">{t("ctaSubtitle")}</p>
            </div>
            <RequestCtaLink
              href={`/create-request?category=${activeSlug}`}
              className="rounded-lg bg-secondary px-6 py-3 font-semibold text-white hover:bg-secondary/90"
            >
              {t("ctaButton")}
            </RequestCtaLink>
          </div>
        </div>
      </section>

      {/* Filters & Providers */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {categoryUnavailable || providersUnavailable ? (
            <AlertBanner className="mb-6">
              {t("providersUnavailable")}
            </AlertBanner>
          ) : null}
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Filters */}
            <aside className="w-full lg:w-64">
              <div className="rounded-xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-semibold">{t("filters.title")}</h3>

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium">
                    {t("filters.postalCode")}
                  </label>
                  <input
                    type="text"
                    placeholder={t("filters.postalPlaceholder")}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium">
                    {t("filters.minimumRating")}
                  </label>
                  <select className="w-full rounded-lg border border-border px-3 py-2 focus:border-primary focus:outline-none">
                    <option value="">{t("filters.allRatings")}</option>
                    <option value="4">{t("filters.rating4")}</option>
                    <option value="4.5">{t("filters.rating45")}</option>
                  </select>
                </div>

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium">
                    {t("filters.price")}
                  </label>
                  <select className="w-full rounded-lg border border-border px-3 py-2 focus:border-primary focus:outline-none">
                    <option value="">{t("filters.allPrices")}</option>
                    <option value="low">{t("filters.budget")}</option>
                    <option value="mid">{t("filters.mid")}</option>
                    <option value="high">{t("filters.premium")}</option>
                  </select>
                </div>

                <button className="w-full rounded-lg bg-primary py-2 text-white hover:bg-primary-dark">
                  {t("filters.apply")}
                </button>
              </div>
            </aside>

            {/* Providers List */}
            <div className="flex-1">
              <div className="mb-6 flex items-center justify-between">
                <p className="text-muted">
                  {t("providersFound", { count: meta.total })}
                </p>
                <select className="rounded-lg border border-border px-3 py-2 focus:border-primary focus:outline-none">
                  <option>{t("sortTopRated")}</option>
                  <option>{t("sortMostReviews")}</option>
                  <option>{t("sortLowestPrice")}</option>
                </select>
              </div>

              {providers.length === 0 ? (
                <div className="rounded-xl bg-white p-8 text-center text-muted shadow-sm">
                  {categoryUnavailable || providersUnavailable
                    ? t("providersUnavailable")
                    : t("noProviders")}
                </div>
              ) : (
                <div className="space-y-4">
                  {providers.map((provider) => {
                    const providerName =
                      `${provider.user.firstName} ${provider.user.lastName}`.trim();
                    const companyName = provider.companyName || providerName;
                    const showPerson = companyName !== providerName;
                    const service = category
                      ? getServiceForCategory(provider, category.id)
                      : provider.services[0];

                    return (
                      <div
                        key={provider.id}
                        className="rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex gap-4">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-white">
                            {providerName.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold">{companyName}</h3>
                                {showPerson ? (
                                  <p className="text-sm text-muted">
                                    {providerName}
                                  </p>
                                ) : null}
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-primary">
                                  {formatPrice(service)}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-yellow-500">★</span>
                              <span className="font-medium">
                                {ratingFormatter.format(provider.ratingAvg)}
                              </span>
                              <span className="text-muted">
                                {t("reviewsCount", {
                                  count: provider.totalReviews,
                                })}
                              </span>
                            </div>
                            <p className="mt-2 text-muted">
                              {provider.description}
                            </p>
                            <div className="mt-4 flex gap-3">
                              <RequestCtaLink
                                href={`/create-request?category=${activeSlug}`}
                                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
                              >
                                {t("requestQuote")}
                              </RequestCtaLink>
                              <Link
                                href={`/providers/${provider.id}`}
                                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
                              >
                                {t("viewProfile")}
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {meta.totalPages > 1 ? (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <Link
                    href={buildCategoryPageHref(activeSlug, {
                      ...resolvedSearchParams,
                      page: String(Math.max(1, currentPage - 1)),
                    })}
                    aria-disabled={currentPage === 1}
                    className={`rounded-lg border border-border px-4 py-2 hover:bg-background ${
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    {t("previous")}
                  </Link>
                  <span className="px-3 text-sm text-muted">
                    {t("pagination", {
                      current: currentPage,
                      total: meta.totalPages,
                    })}
                  </span>
                  <Link
                    href={buildCategoryPageHref(activeSlug, {
                      ...resolvedSearchParams,
                      page: String(Math.min(meta.totalPages, currentPage + 1)),
                    })}
                    aria-disabled={currentPage >= meta.totalPages}
                    className={`rounded-lg border border-border px-4 py-2 hover:bg-background ${
                      currentPage >= meta.totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }`}
                  >
                    {t("next")}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
