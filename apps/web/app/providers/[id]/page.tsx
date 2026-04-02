import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AlertBanner,
  Footer,
  Header,
  PageContainer,
  PanelCard,
  RequestOfferModal,
  ProviderOpeningHours,
  ProviderRatingStars,
  ProviderReviewCard,
} from "@/components";
import {
  isApiNotFoundError,
  isApiUnavailableError,
  providersApi,
  type ProviderService,
} from "@/lib/api";

export default async function ProviderProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const t = await getTranslations("providerPublicProfile");
  const tNav = await getTranslations("nav");
  const { id } = await params;

  let profile: Awaited<ReturnType<typeof providersApi.getProfile>> | null = null;
  try {
    profile = await providersApi.getProfile(id);
  } catch (error) {
    if (isApiNotFoundError(error)) {
      notFound();
    }
    if (isApiUnavailableError(error)) {
      profile = null;
    } else {
      throw error;
    }
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <PageContainer className="py-10">
          <AlertBanner>{t("profileUnavailable")}</AlertBanner>
        </PageContainer>
        <Footer />
      </div>
    );
  }

  const companyName =
    profile.companyName ||
    `${profile.user.firstName} ${profile.user.lastName}`.trim();
  const ratingFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const memberSince = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
  }).format(new Date(profile.memberSince));

  const formatPrice = (service?: ProviderService) => {
    if (!service) return t("priceQuote");

    const min = service.priceMin ?? null;
    const max = service.priceMax ?? null;

    if (min === null && max === null) return t("priceQuote");

    const formatCurrency = (value: number) => currencyFormatter.format(value);

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

  const displayHours = Array.isArray(profile.profile.openingHours)
    ? profile.profile.openingHours
    : [];
  const firstCategoryId = profile.services[0]?.category.id;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative overflow-hidden bg-primary py-10 text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-dark/70 to-primary/60" />
        <PageContainer className="relative">
          <nav className="mb-4 text-sm text-white/80">
            <Link href="/" className="hover:text-white">
              {tNav("home")}
            </Link>
            {" / "}
            <Link href="/categories" className="hover:text-white">
              {tNav("categories")}
            </Link>
            {" / "}
            <span>{companyName}</span>
          </nav>

          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="flex items-start gap-4">
              {profile.user.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.user.profileImage}
                  alt={companyName}
                  className="h-20 w-20 rounded-2xl border border-white/30 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-3xl font-semibold">
                  {companyName.charAt(0)}
                </div>
              )}

              <div>
                <h1 className="text-2xl font-bold md:text-4xl">
                  {companyName}
                </h1>
                {profile.profile.headline ? (
                  <p className="mt-1 text-white/90">
                    {profile.profile.headline}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ProviderRatingStars
                    value={profile.ratingAvg}
                    sizeClassName="text-lg"
                  />
                  <span className="font-semibold">
                    {ratingFormatter.format(profile.ratingAvg)}
                  </span>
                  <span className="text-white/80">
                    {t("reviewsCount", { count: profile.totalReviews })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <RequestOfferModal
                categoryId={firstCategoryId}
                providerName={companyName}
                serviceName={profile.services[0]?.title}
                defaultPostalCode={profile.profile.postalCode || ""}
                defaultCity={profile.profile.city || ""}
              />
              {profile.profile.website ? (
                <a
                  href={profile.profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/50 px-5 py-2.5 font-semibold hover:bg-white/10"
                >
                  {t("visitWebsite")}
                </a>
              ) : null}
            </div>
          </div>
        </PageContainer>
      </section>

      <PageContainer className="py-8">
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <PanelCard>
              <h2 className="text-xl font-semibold">{t("about")}</h2>
              <p className="mt-3 text-muted">
                {profile.profile.bio || profile.description}
              </p>

              {profile.profile.highlights.length ? (
                <div className="mt-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                    {t("highlights")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.profile.highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="rounded-full border border-border px-3 py-1 text-sm"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {profile.profile.languages.length ? (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                    {t("languages")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.profile.languages.map((language) => (
                      <span
                        key={language}
                        className="rounded-full bg-background px-3 py-1 text-sm text-foreground"
                      >
                        {language}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </PanelCard>

            <PanelCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{t("services")}</h2>
                <span className="text-sm text-muted">
                  {profile.services.length}
                </span>
              </div>
              <div className="space-y-3">
                {profile.services.map((service) => (
                  <article
                    key={service.id}
                    className="rounded-lg border border-border p-4 transition hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted">
                          {service.category.icon} {service.category.nameEn}
                        </p>
                        <h3 className="font-semibold">{service.title}</h3>
                      </div>
                      <p className="font-semibold text-primary">
                        {formatPrice(service)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      {service.description}
                    </p>
                  </article>
                ))}
              </div>
            </PanelCard>

            <PanelCard>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">{t("reviews")}</h2>
                <span className="text-sm text-muted">
                  {t("reviewsCount", { count: profile.totalReviews })}
                </span>
              </div>

              {profile.reviews.items.length ? (
                <div className="space-y-3">
                  {profile.reviews.items.map((review) => (
                    <ProviderReviewCard
                      key={review.id}
                      review={review}
                      locale={locale}
                      labels={{
                        reviewedOn: t("ratedOn"),
                        providerReply: t("providerReply"),
                        noComment: t("noComment"),
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">{t("noReviews")}</p>
              )}
            </PanelCard>
          </div>

          <div className="space-y-6">
            <PanelCard>
              <h2 className="text-lg font-semibold">{t("contact")}</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-muted">{t("location")}</dt>
                  <dd className="mt-1 font-medium">
                    {[
                      profile.profile.addressLine1,
                      profile.profile.postalCode,
                      profile.profile.city,
                    ]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t("serviceArea")}</dt>
                  <dd className="mt-1 font-medium">
                    {t("km", { count: Math.round(profile.serviceAreaRadius) })}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t("call")}</dt>
                  <dd className="mt-1 font-medium">
                    {profile.user.phone || "-"}
                  </dd>
                </div>
              </dl>
            </PanelCard>

            <PanelCard>
              <h2 className="mb-4 text-lg font-semibold">
                {t("businessHours")}
              </h2>
              <ProviderOpeningHours
                hours={displayHours}
                labels={{
                  closed: t("closed"),
                  unknown: t("unknownHours"),
                  days: {
                    monday: t("days.monday"),
                    tuesday: t("days.tuesday"),
                    wednesday: t("days.wednesday"),
                    thursday: t("days.thursday"),
                    friday: t("days.friday"),
                    saturday: t("days.saturday"),
                    sunday: t("days.sunday"),
                  },
                }}
              />
            </PanelCard>

            <PanelCard>
              <h2 className="text-lg font-semibold">{t("quickFacts")}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted">{t("experience")}</span>
                  <span className="font-medium">
                    {t("years", { count: profile.experienceYears })}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted">{t("completedJobs")}</span>
                  <span className="font-medium">{profile.completedJobs}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted">{t("acceptanceRate")}</span>
                  <span className="font-medium">{profile.acceptanceRate}%</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-muted">{t("memberSince")}</span>
                  <span className="font-medium">{memberSince}</span>
                </li>
              </ul>
            </PanelCard>
          </div>
        </div>
      </PageContainer>

      <Footer />
    </div>
  );
}
