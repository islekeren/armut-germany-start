"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AccountSettingsContent, Header } from "@/components";

export default function CustomerSettingsPage() {
  const t = useTranslations();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/customer-dashboard" className="hover:text-primary">
            {t("nav.dashboard")}
          </Link>
          {" / "}
          <span>Settings</span>
        </nav>

        <h1 className="mb-8 text-2xl font-bold">Settings</h1>

        <AccountSettingsContent roleLabel="Customer" />
      </div>
    </div>
  );
}
