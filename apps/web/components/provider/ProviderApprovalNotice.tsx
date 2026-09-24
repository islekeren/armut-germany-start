"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts";
import { getStoredAccessToken, providerApi } from "@/lib/api";
import { AlertBanner } from "@/components/ui/AlertBanner";

let cachedApproval: { userId: string; isApproved: boolean } | null = null;

/**
 * Whether the signed-in provider has been approved by an admin.
 * `null` while unknown (loading, not a provider, or the lookup failed).
 */
export function useProviderApproval(): boolean | null {
  const { user } = useAuth();
  const userId = user?.userType === "provider" ? user.id : null;
  const [isApproved, setIsApproved] = useState<boolean | null>(
    cachedApproval && cachedApproval.userId === userId
      ? cachedApproval.isApproved
      : null,
  );

  useEffect(() => {
    if (!userId) return;
    // Approval can change at any time, so only an approved result is cached.
    if (cachedApproval?.userId === userId && cachedApproval.isApproved) return;

    const token = getStoredAccessToken();
    if (!token) return;

    let cancelled = false;
    providerApi
      .getProfile(token)
      .then((profile) => {
        cachedApproval = { userId, isApproved: profile.isApproved };
        if (!cancelled) setIsApproved(profile.isApproved);
      })
      .catch(() => {
        // Leave the state unknown; the API still enforces approval.
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return userId ? isApproved : null;
}

export function ProviderApprovalNotice({ className = "" }: { className?: string }) {
  const t = useTranslations("provider.approval");
  const isApproved = useProviderApproval();

  if (isApproved !== false) return null;

  return (
    <AlertBanner variant="info" className={className}>
      <p className="font-semibold">{t("pendingTitle")}</p>
      <p className="mt-1 font-normal">{t("pendingDescription")}</p>
    </AlertBanner>
  );
}
