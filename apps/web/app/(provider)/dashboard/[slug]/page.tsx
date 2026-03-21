import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProviderSubpageShell } from "@/components";
import { ComingSoonState } from "@/components/ui/ComingSoonState";

export default async function ProviderComingSoonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations();
  const tNav = await getTranslations("provider.dashboard.navigation");
  const tDashboard = await getTranslations("provider.dashboard");

  const titles = {
    orders: tNav("orders"),
    finances: tNav("finances"),
    settings: tNav("settings"),
    services: tDashboard("quickActionButtons.manageServices"),
  } as const;

  const title = titles[slug as keyof typeof titles];

  if (!title) {
    notFound();
  }

  return (
    <ProviderSubpageShell title={title} backLabel={tNav("overview")}>
      <ComingSoonState
        badge={t("comingSoon.badge")}
        title={title}
        description={t("comingSoon.description", { page: title })}
        backHref="/dashboard"
        backLabel={tNav("overview")}
      />
    </ProviderSubpageShell>
  );
}
