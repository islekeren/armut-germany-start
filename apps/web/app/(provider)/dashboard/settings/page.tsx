"use client";

import { useTranslations } from "next-intl";
import { ProviderSubpageShell, PanelCard } from "@/components";

export default function ProviderSettingsPage() {
  const tNav = useTranslations("provider.dashboard.navigation");
  const tProvider = useTranslations("provider");

  return (
    <ProviderSubpageShell title={tNav("settings")} backLabel={tNav("overview")}>
      <PanelCard>
        <p className="text-sm text-muted">{tProvider("placeholders.comingSoon")}</p>
      </PanelCard>
    </ProviderSubpageShell>
  );
}
