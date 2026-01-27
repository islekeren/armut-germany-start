"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components";

export default function Home() {
  const t = useTranslations();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary to-primary-dark py-20 text-white flex-1">
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

          {/* CTA Buttons */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="rounded-lg bg-white px-8 py-3 font-semibold text-primary hover:bg-white/90"
            >
              {t("common.register")}
            </Link>
            <Link
              href="/login"
              className="rounded-lg border-2 border-white px-8 py-3 font-semibold text-white hover:bg-white/10"
            >
              {t("common.login")}
            </Link>
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

      {/* Footer */}
      <Footer />
    </div>
  );
}
