import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Header, Footer, RequestCtaLink } from "@/components";

export default async function HowItWorksPage() {
  const t = await getTranslations();

  const steps = [
    { number: 1, key: "detailedStep1", icon: "📝" },
    { number: 2, key: "detailedStep2", icon: "📬" },
    { number: 3, key: "detailedStep3", icon: "✅" },
    { number: 4, key: "step4", icon: "🎉" },
  ];

  const benefitKeys = ["free", "verified", "fast", "secure", "quality", "local"];
  const benefitIcons: Record<string, string> = {
    free: "💰",
    verified: "🛡️",
    fast: "⚡",
    secure: "🔒",
    quality: "⭐",
    local: "📍",
  };

  const faqKeys = ["q1", "q2", "q3", "q4", "q5"];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-primary py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold md:text-5xl">{t("howItWorks.pageTitle")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            {t("howItWorks.pageSubtitle")}
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.number} className="relative">
                {index < steps.length - 1 && (
                  <div className="absolute right-0 top-12 hidden h-1 w-full bg-primary/20 lg:block" />
                )}
                <div className="relative rounded-xl bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl">
                    {step.icon}
                  </div>
                  <div className="mb-2 text-sm font-semibold text-primary">
                    {step.number}
                  </div>
                  <h3 className="mb-2 text-xl font-bold">{t(`howItWorks.${step.key}.title`)}</h3>
                  <p className="text-muted">{t(`howItWorks.${step.key}.description`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-secondary py-12">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            {t("cta.readyToStart")}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-white/90">
            {t("cta.createFirstRequest")}
          </p>
          <RequestCtaLink
            href="/create-request"
            className="mt-6 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-secondary hover:bg-white/90"
          >
            {t("cta.createRequestNow")}
          </RequestCtaLink>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold">
            {t("becomeProvider.benefits.title")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {benefitKeys.map((key) => (
              <div
                key={key}
                className="rounded-xl bg-white p-6 shadow-sm"
              >
                <div className="mb-4 text-4xl">{benefitIcons[key]}</div>
                <h3 className="mb-2 text-lg font-semibold">{t(`benefits.${key}.title`)}</h3>
                <p className="text-muted">{t(`benefits.${key}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold">
            {t("faq.title")}
          </h2>
          <div className="space-y-6">
            {faqKeys.map((key) => (
              <div key={key} className="rounded-xl bg-background p-6">
                <h3 className="mb-2 text-lg font-semibold">{t(`faq.${key}.question`)}</h3>
                <p className="text-muted">{t(`faq.${key}.answer`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
