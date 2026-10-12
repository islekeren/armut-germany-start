"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useProviderOnboardingCheck } from "@/components";
import { useAuth } from "@/contexts";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const t = useTranslations("providerOnboarding");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const redirectPath = query ? `${pathname}?${query}` : pathname;

  const isProvider = !isLoading && isAuthenticated && user?.userType === "provider";
  const profileCheck = useProviderOnboardingCheck(isProvider);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    if (user?.userType !== "provider") {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, redirectPath, router, user?.userType]);

  useEffect(() => {
    if (profileCheck.status === "missing") {
      router.replace("/provider-onboarding");
    }
  }, [profileCheck.status, router]);

  if (isLoading || !isAuthenticated || user?.userType !== "provider") {
    return null;
  }

  if (profileCheck.status !== "exists") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p role="status">
          {t(
            profileCheck.status === "error"
              ? "errors.profileCheck"
              : "checkingProfile",
          )}
        </p>
        {profileCheck.status === "error" && (
          <button
            className="rounded-lg bg-secondary px-6 py-3 text-white"
            onClick={profileCheck.retry}
          >
            {t("buttons.retry")}
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
