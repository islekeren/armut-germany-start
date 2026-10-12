"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { reportClientError } from "@/lib/observability";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("providerOnboarding");

  useEffect(() => {
    reportClientError({ operation: "unknown", code: "render" });
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
      <p role="alert" className="text-lg text-slate-700">{t("errors.generic")}</p>
      <button type="button" onClick={reset} className="rounded-full bg-slate-900 px-6 py-3 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2">
        {t("buttons.retry")}
      </button>
    </main>
  );
}
