"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts";
import {
  getStoredAccessToken,
  isApiNotFoundError,
  providerApi,
  type ProviderProfile,
} from "@/lib/api";

export type ProviderOnboardingStatus =
  | "checking"
  | "exists"
  | "missing"
  | "error";

let cachedProfile: { userId: string; profile: ProviderProfile } | null = null;

/**
 * Whether the signed-in provider account already has a provider profile,
 * plus that profile's data. Shared by the dashboard layout (which must
 * route away when there is none), the onboarding page (which resumes a
 * submission lost to a dropped response), and dashboard pages that only
 * need the already-fetched profile (e.g. its active services) without
 * issuing a second request of their own.
 */
export function useProviderOnboardingCheck(enabled: boolean) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<ProviderOnboardingStatus>(
    cachedProfile?.userId === userId ? "exists" : "checking",
  );
  const [profile, setProfile] = useState<ProviderProfile | null>(
    cachedProfile?.userId === userId ? cachedProfile.profile : null,
  );
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (cachedProfile?.userId === userId) {
      setStatus("exists");
      setProfile(cachedProfile.profile);
      return;
    }
    let cancelled = false;
    setStatus("checking");
    const token = getStoredAccessToken();
    if (!token) {
      setStatus("error");
      return;
    }
    providerApi
      .getProfile(token)
      .then((result) => {
        if (cancelled) return;
        cachedProfile = userId ? { userId, profile: result } : null;
        setProfile(result);
        setStatus("exists");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(isApiNotFoundError(error) ? "missing" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, retryCount]);

  return {
    status,
    profile,
    retry: () => {
      cachedProfile = null;
      setRetryCount((value) => value + 1);
    },
  };
}
