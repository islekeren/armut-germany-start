import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { Header, Footer } from "@/components";
import { getCategories } from "@/lib/api";

export default async function Home() {
  const t = await getTranslations();
  const locale = await getLocale();
  const isGerman = locale.startsWith("de");
  const categories = (await getCategories()).slice(0, 6);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary to-primary-dark py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mb-6 text-4xl font-bold md:text-5xl lg:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90 md:text-xl">
            {t("hero.subtitle")}
          </p>

          {/* Search Box */}
          <div className="mx-auto max-w-2xl">
            <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-lg md:flex-row">
              <input
                type="text"
                placeholder={t("hero.searchPlaceholder")}
                className="flex-1 rounded-lg border border-border px-4 py-3 text-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder={t("hero.postalCode")}
                className="w-full rounded-lg border border-border px-4 py-3 text-foreground focus:border-primary focus:outline-none md:w-32"
              />
              <button className="rounded-lg bg-secondary px-6 py-3 font-semibold text-white hover:bg-secondary/90">
                {t("common.search")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-8 text-center text-3xl font-bold">{t("categories.title")}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const displayName = isGerman ? category.nameDe : category.nameEn;
              return (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="group rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-4 text-4xl">{category.icon}</div>
                  <h3 className="mb-2 text-xl font-semibold group-hover:text-primary">
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

      {/* How it works */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold">{t("howItWorks.title")}</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                1
              </div>
              <h3 className="mb-2 text-xl font-semibold">{t("howItWorks.step1.title")}</h3>
              <p className="text-muted">
                {t("howItWorks.step1.description")}
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                2
              </div>
              <h3 className="mb-2 text-xl font-semibold">{t("howItWorks.step2.title")}</h3>
              <p className="text-muted">
                {t("howItWorks.step2.description")}
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                3
              </div>
              <h3 className="mb-2 text-xl font-semibold">{t("howItWorks.step3.title")}</h3>
              <p className="text-muted">
                {t("howItWorks.step3.description")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-secondary py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-3xl font-bold">{t("cta.providerTitle")}</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
            {t("cta.providerSubtitle")}
          </p>
          <Link
            href="/become-provider"
            className="inline-block rounded-lg bg-white px-8 py-3 font-semibold text-secondary hover:bg-white/90"
          >
            {t("cta.registerNow")}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 text-lg font-semibold">Armut Germany</h3>
              <p className="text-white/70">
                {t("footer.description")}
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">{t("footer.forCustomers")}</h4>
              <ul className="space-y-2 text-white/70">
                <li><Link href="/categories" className="hover:text-white">{t("nav.categories")}</Link></li>
                <li><Link href="/how-it-works" className="hover:text-white">{t("nav.howItWorks")}</Link></li>
                <li><Link href="/hilfe" className="hover:text-white">{t("footer.help")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">{t("footer.forProviders")}</h4>
              <ul className="space-y-2 text-white/70">
                <li><Link href="/become-provider" className="hover:text-white">{t("footer.becomeProvider")}</Link></li>
                <li><Link href="/preise" className="hover:text-white">{t("footer.pricing")}</Link></li>
                <li><Link href="/erfolgsgeschichten" className="hover:text-white">{t("footer.successStories")}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">{t("footer.legal")}</h4>
              <ul className="space-y-2 text-white/70">
                <li><Link href="/imprint" className="hover:text-white">{t("footer.imprint")}</Link></li>
                <li><Link href="/privacy" className="hover:text-white">{t("footer.privacy")}</Link></li>
                <li><Link href="/terms" className="hover:text-white">{t("footer.terms")}</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-white/20 pt-8 text-center text-white/70">
            <p>&copy; {new Date().getFullYear()} Armut Germany. {t("common.allRightsReserved")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
