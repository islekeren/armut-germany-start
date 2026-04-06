"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts";

export function HomeRedirect() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user?.userType) return;

    if (user.userType === "provider") {
      router.replace("/dashboard");
      return;
    }

    if (user.userType === "customer") {
      router.replace("/customer-dashboard");
    }
  }, [isAuthenticated, isLoading, router, user?.userType]);

  return null;
}
