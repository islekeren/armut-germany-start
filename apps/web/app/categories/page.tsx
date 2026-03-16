import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { AlertBanner, Header, Footer } from "@/components";
import { getCategories, isApiUnavailableError, type Category } from "@/lib/api";

type CategoryWithServiceCount = Category & {
  _count?: {
    services?: number;
  };
};

export default async function CategoriesPage() {
  const t = await getTranslations("categoriesPage");
  const locale = await getLocale();
  const isGerman = locale.startsWith("de");
  let categories: Category[] = [];
  let categoriesUnavailable = false;

  try {
    categories = await getCategories();
  } catch (error) {
    if (isApiUnavailableError(error)) {
      categoriesUnavailable = true;
    } else {
      throw error;
    }
  }

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
          {categoriesUnavailable ? (
            <AlertBanner className="mb-6">{t("categoriesUnavailable")}</AlertBanner>
          ) : null}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {categories.map((category) => {
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
                    {t("providersCount", {
                      count: (category as CategoryWithServiceCount)._count?.services ?? 0,
                    })}
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
