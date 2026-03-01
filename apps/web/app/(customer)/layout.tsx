"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
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

    if (user?.userType !== "customer") {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, redirectPath, router, user?.userType]);

  if (isLoading || !isAuthenticated || user?.userType !== "customer") {
    return null;
  }

  return <>{children}</>;
}
