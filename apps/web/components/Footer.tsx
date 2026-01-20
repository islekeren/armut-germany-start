"use client";

import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="bg-foreground py-8 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Armut</span>
            <span className="text-sm text-white/70">Germany</span>
          </div>
          <p className="text-white/70">{t("footer.description")}</p>
        </div>
        <div className="mt-6 border-t border-white/20 pt-6 text-center text-white/70">
          <p>
            &copy; {new Date().getFullYear()} Armut Germany.{" "}
            {t("common.allRightsReserved")}
          </p>
        </div>
      </div>
    </footer>
  );
}
