"use client";

import Link from "next/link";
import { useAuth } from "@/contexts";

interface RequestCtaLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
}

export function RequestCtaLink({ href, className, children }: RequestCtaLinkProps) {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated && user?.userType === "provider") {
    return null;
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
