"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { emitRouteChangeMessage } from "@/lib/native-bridge";

export function NativeWebViewBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  useEffect(() => {
    const path = query ? `${pathname}?${query}` : pathname;
    emitRouteChangeMessage(path);
  }, [pathname, query]);

  return null;
}
