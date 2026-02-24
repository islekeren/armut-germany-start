import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { Header, Footer } from "@/components";
import { getCategories, providersApi } from "@/lib/api";

export default async function CategoriesPage() {
  const t = await getTranslations("categoriesPage");
  const locale = await getLocale();
  const isGerman = locale.startsWith("de");
  const categories = await getCategories();
  const providerCounts = await Promise.all(
    categories.map(async (category) => {
      const result = await providersApi.getAll({
        categoryId: category.id,
        page: 1,
        limit: 1,
      });
      return result.meta.total;
    })
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-primary py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold md:text-4xl">{t("title")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/90">
            {t("subtitle")}
          </p>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category, index) => {
              const displayName = isGerman ? category.nameDe : category.nameEn;
              return (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="group rounded-xl bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-4 text-5xl">{category.icon}</div>
                  <h2 className="text-xl font-semibold group-hover:text-primary">
                    {displayName}
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    {t("cardDescription", { name: displayName })}
                  </p>
                  <div className="mt-4 text-sm text-primary">
                    {t("providersCount", { count: providerCounts[index] ?? 0 })}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
