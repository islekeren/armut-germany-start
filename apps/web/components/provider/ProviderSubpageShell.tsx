import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PageContainer } from "@/components/ui/PageContainer";

interface ProviderSubpageShellProps {
  title: string;
  backLabel: string;
  backHref?: string;
  breadcrumbLabel?: string;
  headerSlot?: ReactNode;
  children: ReactNode;
}

export function ProviderSubpageShell({
  title,
  backLabel,
  backHref = "/dashboard",
  breadcrumbLabel,
  headerSlot,
  children,
}: ProviderSubpageShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <PageContainer className="py-6 sm:py-8">
        <nav className="mb-5 flex flex-wrap items-center gap-1 text-xs text-muted sm:mb-6 sm:text-sm">
          <Link href={backHref} className="hover:text-primary">
            {backLabel}
          </Link>
          {" / "}
          <span>{breadcrumbLabel || title}</span>
        </nav>

        {headerSlot || <h1 className="mb-6 text-xl font-bold sm:mb-8 sm:text-2xl">{title}</h1>}

        {children}
      </PageContainer>
    </div>
  );
}
