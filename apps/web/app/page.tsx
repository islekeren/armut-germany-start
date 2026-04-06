import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { AlertBanner, Header } from "@/components";
import { getCategories, isApiUnavailableError, type Category } from "@/lib/api";
import { HomeRedirect } from "@/components/ProviderHomeRedirect";

export default async function Home() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isGerman = locale.startsWith("de");
  let categories: Category[] = [];
  let categoriesUnavailable = false;

  try {
    categories = (await getCategories()).slice(0, 6);
  } catch (error) {
    if (isApiUnavailableError(error)) {
      categoriesUnavailable = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <HomeRedirect />
      <Header />

      <section className="relative overflow-hidden bg-primary py-20 text-white">
        <div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rotate-12 bg-white/10" />
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mb-6 text-4xl font-extrabold leading-tight md:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90 md:text-xl">
            {t("hero.subtitle")}
          </p>

          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col gap-4 rounded-lg bg-white p-4 md:flex-row">
              <input
                type="text"
                placeholder={t("hero.searchPlaceholder")}
                className="h-14 flex-1 rounded-md border-2 border-transparent bg-gray-100 px-4 text-foreground focus:border-primary focus:bg-white focus:outline-none"
              />
              <input
                type="text"
                placeholder={t("hero.postalCode")}
                className="h-14 w-full rounded-md border-2 border-transparent bg-gray-100 px-4 text-foreground focus:border-primary focus:bg-white focus:outline-none md:w-36"
              />
              <button className="h-14 rounded-md bg-secondary px-8 text-sm font-semibold uppercase tracking-wide text-white transition-all duration-200 hover:scale-105 hover:bg-emerald-600">
                {t("common.search")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gray-100 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-3xl font-extrabold">{t("categories.title")}</h2>
          {categoriesUnavailable ? (
            <AlertBanner className="mb-6">{t("homePage.categoriesUnavailable")}</AlertBanner>
          ) : null}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const displayName = isGerman ? category.nameDe : category.nameEn;
              return (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="group cursor-pointer rounded-lg bg-white p-6 transition-all duration-200 hover:scale-[1.02] hover:bg-blue-50"
                >
                  <div className="mb-4 text-4xl">{category.icon}</div>
                  <h3 className="mb-2 text-xl font-bold group-hover:text-primary">
                    {displayName}
                  </h3>
                  <p className="text-muted">
                    {t("homePage.categoryCardDescription", { name: displayName })}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-extrabold">{t("howItWorks.title")}</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-white">
                1
              </div>
              <h3 className="mb-2 text-xl font-bold">{t("howItWorks.step1.title")}</h3>
              <p className="text-muted">
                {t("howItWorks.step1.description")}
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-2xl font-extrabold text-white">
                2
              </div>
              <h3 className="mb-2 text-xl font-bold">{t("howItWorks.step2.title")}</h3>
              <p className="text-muted">
                {t("howItWorks.step2.description")}
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500 text-2xl font-extrabold text-white">
                3
              </div>
              <h3 className="mb-2 text-xl font-bold">{t("howItWorks.step3.title")}</h3>
              <p className="text-muted">
                {t("howItWorks.step3.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-amber-500 py-16 text-white">
        <div className="absolute -right-24 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-extrabold">{t("cta.providerTitle")}</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
            {t("cta.providerSubtitle")}
          </p>
          <Link
            href="/become-provider"
            className="inline-flex h-14 items-center rounded-md bg-white px-8 text-sm font-semibold uppercase tracking-wide text-amber-600 transition-all duration-200 hover:scale-105 hover:bg-gray-100"
          >
            {t("cta.registerNow")}
          </Link>
        </div>
      </section>

      <footer className="bg-foreground py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 text-lg font-bold">Armut Germany</h3>
              <p className="text-white/70">
                {t("footer.description")}
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold uppercase tracking-wide">{t("footer.forCustomers")}</h4>
              <ul className="space-y-2 text-white/70">
                <li><Link href="/categories" className="hover:text-white">{t("nav.categories")}</Link></li>
                <li><Link href="/how-it-works" className="hover:text-white">{t("nav.howItWorks")}</Link></li>
                <li><Link href="/help" className="hover:text-white">{t("footer.help")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold uppercase tracking-wide">{t("footer.forProviders")}</h4>
              <ul className="space-y-2 text-white/70">
                <li><Link href="/become-provider" className="hover:text-white">{t("footer.becomeProvider")}</Link></li>
                <li><Link href="/pricing" className="hover:text-white">{t("footer.pricing")}</Link></li>
                <li><Link href="/success-stories" className="hover:text-white">{t("footer.successStories")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold uppercase tracking-wide">{t("footer.legal")}</h4>
              <ul className="space-y-2 text-white/70">
                <li><Link href="/imprint" className="hover:text-white">{t("footer.imprint")}</Link></li>
                <li><Link href="/privacy" className="hover:text-white">{t("footer.privacy")}</Link></li>
                <li><Link href="/terms" className="hover:text-white">{t("footer.terms")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t-2 border-white/20 pt-8 text-center text-white/70">
            <p>&copy; {new Date().getFullYear()} Armut Germany. {t("common.allRightsReserved")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
