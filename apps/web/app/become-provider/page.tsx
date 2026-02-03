"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Header, Footer } from "@/components";

const benefitKeys = [
  "newCustomers",
  "flexible",
  "freeRegistration",
  "easyManagement",
  "buildReputation",
  "support",
];

const benefitIcons: Record<string, string> = {
  newCustomers: "👥",
  flexible: "🕐",
  freeRegistration: "💶",
  easyManagement: "📊",
  buildReputation: "⭐",
  support: "🤝",
};

const categoryKeys = [
  "cleaning",
  "moving",
  "renovation",
  "garden",
  "electrician",
  "plumber",
  "painter",
  "locksmith",
  "tutoring",
  "photography",
  "computerHelp",
  "petCare",
];

export default function BecomeProviderPage() {
  const t = useTranslations();
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    category: "",
    postalCode: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect to full registration
    window.location.href = `/provider-onboarding?email=${formData.email}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-secondary to-secondary/80 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl font-bold md:text-5xl">
                {t("becomeProvider.title")}
              </h1>
              <p className="mt-4 text-xl text-white/90">
                {t("becomeProvider.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#anmeldung"
                  className="rounded-lg bg-white px-6 py-3 font-semibold text-secondary hover:bg-white/90"
                >
                  {t("becomeProvider.registerNow")}
                </a>
                <a
                  href="#vorteile"
                  className="rounded-lg border-2 border-white px-6 py-3 font-semibold text-white hover:bg-white/10"
                >
                  {t("common.learnMore")}
                </a>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="rounded-2xl bg-white/10 p-8">
                <div className="text-center">
                  <div className="mb-4 text-6xl">🔧</div>
                  <div className="text-3xl font-bold">{t("becomeProvider.stats.providers").split(" ")[0]}</div>
                  <div className="text-white/80">{t("becomeProvider.stats.providers").split(" ").slice(1).join(" ")}</div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{t("becomeProvider.stats.customers").split(" ")[0]}</div>
                    <div className="text-sm text-white/80">{t("becomeProvider.stats.customers").split(" ").slice(1).join(" ")}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{t("becomeProvider.stats.rating").split(" ").slice(0, 2).join(" ")}</div>
                    <div className="text-sm text-white/80">{t("becomeProvider.stats.rating").split(" ").slice(2).join(" ")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold">
            {t("becomeProvider.howItWorks")}
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((num) => (
              <div key={num} className="relative">
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-xl font-bold text-white">
                    {num}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{t(`becomeProvider.steps.step${num}.title`)}</h3>
                  <p className="text-muted">{t(`becomeProvider.steps.step${num}.description`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="vorteile" className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold">{t("becomeProvider.benefits.title")}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefitKeys.map((key) => (
              <div
                key={key}
                className="rounded-xl bg-background p-6"
              >
                <div className="mb-4 text-4xl">{benefitIcons[key]}</div>
                <h3 className="mb-2 text-lg font-semibold">{t(`becomeProvider.benefits.${key}.title`)}</h3>
                <p className="text-muted">{t(`becomeProvider.benefits.${key}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section id="anmeldung" className="py-16">
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <h2 className="mb-2 text-center text-2xl font-bold">
              {t("becomeProvider.form.title")}
            </h2>
            <p className="mb-8 text-center text-muted">
              {t("becomeProvider.form.subtitle")}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {t("becomeProvider.form.companyName")}
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
                <label className="mb-2 block text-sm font-medium">
                  {t("becomeProvider.form.contactPerson")}
                </label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) =>
                    setFormData({ ...formData, contactName: e.target.value })
                  }
                  className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {t("becomeProvider.form.email")}
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
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {t("becomeProvider.form.phone")}
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
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {t("becomeProvider.form.mainCategory")}
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full rounded-lg border border-border px-4 py-3 focus:border-secondary focus:outline-none"
                    required
                  >
                    <option value="">{t("becomeProvider.form.pleaseSelect")}</option>
                    {categoryKeys.map((key) => (
                      <option key={key} value={key}>
                        {t(`categories.${key}.name`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    {t("becomeProvider.form.postalCode")}
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
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-secondary py-3 font-semibold text-white hover:bg-secondary/90"
              >
                {t("becomeProvider.form.submit")}
              </button>

              <p className="text-center text-sm text-muted">
                {t("becomeProvider.form.termsNote").split("AGB")[0]}
                <Link href="/terms" className="text-secondary hover:underline">
                  {t("footer.terms")}
                </Link>{" "}
                &{" "}
                <Link
                  href="/privacy"
                  className="text-secondary hover:underline"
                >
                  {t("footer.privacy")}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
