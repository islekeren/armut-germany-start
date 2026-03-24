"use client";

import { useTranslations } from "next-intl";
import { ProviderSubpageShell, PanelCard } from "@/components";

export default function ProviderServicesPage() {
  const tDashboard = useTranslations("provider.dashboard");
  const tNav = useTranslations("provider.dashboard.navigation");
  const tProvider = useTranslations("provider");

  return (
    <ProviderSubpageShell
      title={tDashboard("quickActionButtons.manageServices")}
      backLabel={tNav("overview")}
      breadcrumbLabel={tDashboard("quickActionButtons.manageServices")}
    >
      <PanelCard>
        <p className="text-sm text-muted">{tProvider("placeholders.comingSoon")}</p>
      </PanelCard>
    </ProviderSubpageShell>
  );
}
