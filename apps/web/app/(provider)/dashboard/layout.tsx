"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getStoredAccessToken,
  isApiNotFoundError,
  providerApi,
} from "@/lib/api";
import { useAuth } from "@/contexts";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const t = useTranslations("providerOnboarding");
  const [profileState, setProfileState] = useState<
    "checking" | "ready" | "error"
  >("checking");
  const [retry, setRetry] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.toString();
  const redirectPath = query ? `${pathname}?${query}` : pathname;

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
    if (isLoading || !isAuthenticated || user?.userType !== "provider") return;
    let cancelled = false;
    setProfileState("checking");
    const token = getStoredAccessToken();
    if (!token) return;
    providerApi
      .getProfile(token)
      .then(() => {
        if (!cancelled) setProfileState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isApiNotFoundError(error)) router.replace("/provider-onboarding");
        else setProfileState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, user?.id, user?.userType, router, retry]);

  if (isLoading || !isAuthenticated || user?.userType !== "provider") {
    return null;
  }

  if (profileState !== "ready") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p role="status">
          {t(
            profileState === "error"
              ? "errors.profileCheck"
              : "checkingProfile",
          )}
        </p>
        {profileState === "error" && (
          <button
            className="rounded-lg bg-secondary px-6 py-3 text-white"
            onClick={() => setRetry((value) => value + 1)}
          >
            {t("buttons.retry")}
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
