"use client";

import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="bg-foreground py-8 text-white sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 text-left md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight">Armut</span>
            <span className="text-sm font-medium uppercase tracking-wider text-white/70">Germany</span>
          </div>
          <p className="max-w-2xl text-sm text-white/70 sm:text-base">{t("footer.description")}</p>
        </div>
        <div className="mt-6 border-t-2 border-white/20 pt-6 text-left text-sm text-white/70 sm:text-center sm:text-base">
          <p>
            &copy; {new Date().getFullYear()} Armut Germany.{" "}
            {t("common.allRightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
}
