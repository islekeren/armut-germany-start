"use client";

import { useTranslations } from "next-intl";
import { AccountSettingsContent, ProviderSubpageShell } from "@/components";

export default function ProviderSettingsPage() {
  const tNav = useTranslations("provider.dashboard.navigation");

  return (
    <ProviderSubpageShell title={tNav("settings")} backLabel={tNav("overview")}>
      <AccountSettingsContent roleLabel="Provider" />
    </ProviderSubpageShell>
  );
}
