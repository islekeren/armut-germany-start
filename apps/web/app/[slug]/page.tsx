import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Footer, Header, PageContainer } from "@/components";
import { ComingSoonState } from "@/components/ui/ComingSoonState";

const PUBLIC_COMING_SOON_TITLES = {
  "forgot-password": "auth.login.forgotPassword",
  help: "footer.help",
  pricing: "footer.pricing",
  "success-stories": "footer.successStories",
  imprint: "footer.imprint",
  privacy: "footer.privacy",
  terms: "footer.terms",
} as const;

export default async function PublicComingSoonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const titleKey = PUBLIC_COMING_SOON_TITLES[slug as keyof typeof PUBLIC_COMING_SOON_TITLES];

  if (!titleKey) {
    notFound();
  }

  const t = await getTranslations();
  const title = t(titleKey);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <PageContainer className="py-16 sm:py-20">
        <ComingSoonState
          badge={t("comingSoon.badge")}
          title={title}
          description={t("comingSoon.description", { page: title })}
          backHref="/"
          backLabel={t("nav.home")}
        />
      </PageContainer>
      <Footer />
    </div>
  );
}
